"""
Audit engine — orchestrates the full audit run.
Iterates selected domains × questions → Groq LLM calls.
Runs as a FastAPI BackgroundTask.

Resilience features:
  • Checkpoint / resume: tracks the last completed question in the DB.
    On restart (e.g. after a crash or server reload), already-completed
    questions are skipped automatically — zero duplication.
  • Rate-limit handling: groq_call_with_retry (via llm_client) detects 429,
    pauses for retry-after, and resumes from the same question.
  • Single API key enforced throughout — no rotation or fallback.
"""
from __future__ import annotations

import json
import hashlib
import logging
import os
import shutil
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import SessionLocal
from ..models.audit import Audit, EvidenceFile, EvidenceDomainMapping, AuditResult
from ..parsers.base import ParsedContent
from ..parsers.registry import parse_file
from .framework_engine import get_domains_by_ids, get_framework
from .evidence_mapper import map_evidence_to_domains, get_evidence_for_domain
from .llm_client import analyze_question
from .audit_trail import log_step

logger = logging.getLogger(__name__)


# ─── Public entry point ───────────────────────────────────────────────────────

def run_audit(audit_id: str) -> None:
    """
    Main audit orchestration. Called as a FastAPI BackgroundTask.
    Opens its own DB session (required for background tasks).
    Resumes from checkpoint if the audit was previously interrupted.
    """
    db = SessionLocal()
    try:
        _run_audit_inner(db, audit_id)
    except Exception as exc:
        logger.exception("Audit %s failed: %s", audit_id, exc)
        audit = db.get(Audit, audit_id)
        if audit:
            audit.status            = "failed"
            audit.scan_status_detail = str(exc)[:200]
            db.commit()
    finally:
        db.close()


# ─── Internal orchestration ───────────────────────────────────────────────────

def _run_audit_inner(db: Session, audit_id: str) -> None:
    audit = db.get(Audit, audit_id)
    if not audit:
        logger.error("Audit %s not found", audit_id)
        return

    # ── Mark running ──────────────────────────────────────────────────────────
    audit.status             = "running"
    audit.scan_status_detail = "Starting…"
    db.commit()

    settings              = get_settings()
    selected_domain_ids: List[str] = json.loads(audit.selected_domains)
    domains               = get_domains_by_ids(selected_domain_ids)
    total_questions       = sum(len(d.audit_questions) for d in domains)
    audit.total_questions = total_questions
    db.commit()

    # ── Build a set of already-completed question IDs (checkpoint resume) ─────
    completed_ids: set[str] = {
        r.question_id
        for r in db.query(AuditResult).filter_by(audit_id=audit_id).all()
    }
    if completed_ids:
        logger.info(
            "Audit %s: resuming from checkpoint — %d / %d questions already done.",
            audit_id, len(completed_ids), total_questions,
        )

    # ── Step 1: Parse uploaded evidence files ─────────────────────────────────
    evidence_files  = db.query(EvidenceFile).filter_by(audit_id=audit_id).all()
    evidence_lookup: dict[str, ParsedContent] = {}

    for ef in evidence_files:
        stored_path = os.path.join(settings.upload_dir, ef.stored_filename)
        t0          = datetime.utcnow()
        parsed      = parse_file(stored_path)
        duration    = int((datetime.utcnow() - t0).total_seconds() * 1000)

        ef.extracted_text    = parsed.text_content
        ef.extraction_method = parsed.extraction_method
        ef.extraction_error  = parsed.error
        ef.page_count        = parsed.page_count
        if parsed.sheet_names:
            ef.sheet_names = json.dumps(parsed.sheet_names)
        if parsed.text_content:
            ef.text_hash = hashlib.sha256(parsed.text_content.encode()).hexdigest()
        db.commit()

        evidence_lookup[ef.id] = parsed
        log_step(
            db, audit_id, "file_parsed",
            evidence_file_id = ef.id,
            input_summary    = f"Parsed {ef.original_filename} ({ef.file_type})",
            output_summary   = (
                f"{len(parsed.text_content or '')} chars extracted, "
                f"method={parsed.extraction_method}"
            ),
            duration_ms = duration,
        )

    # ── Step 2: Map evidence to domains ───────────────────────────────────────
    evidence_items = [(ef.id, evidence_lookup[ef.id]) for ef in evidence_files if ef.id in evidence_lookup]
    domain_map     = map_evidence_to_domains(evidence_items)

    for domain_id, entries in domain_map.items():
        for entry in entries:
            mapping = EvidenceDomainMapping(
                evidence_file_id  = entry["file_id"],
                domain_id         = domain_id,
                match_score       = entry["score"],
                matched_keywords  = json.dumps(entry["matched_keywords"]),
                mapping_method    = entry["method"],
            )
            db.add(mapping)
    db.commit()
    log_step(db, audit_id, "evidence_mapped",
             output_summary=f"Mapped to {len(domain_map)} domains")

    # ── Step 3: Per-question analysis (with checkpoint skip) ──────────────────
    compliant = partial = non_compliant = 0

    # Seed counts from already-completed results
    for r in db.query(AuditResult).filter_by(audit_id=audit_id).all():
        if r.verdict == "compliant":
            compliant += 1
        elif r.verdict == "partial":
            partial += 1
        else:
            non_compliant += 1

    processed = len(completed_ids)

    for domain in domains:
        ev_chunks = get_evidence_for_domain(
            domain.id, domain_map, evidence_lookup,
            max_chars_per_file=settings.max_chars_per_file,
        )

        for question in domain.audit_questions:
            # ── Skip if already done (resume support) ────────────────────────
            if question.id in completed_ids:
                logger.debug("Skipping %s — already completed.", question.id)
                continue

            # ── Update checkpoint in DB before the LLM call ──────────────────
            audit.last_checkpoint    = json.dumps({
                "domain_id":   domain.id,
                "question_id": question.id,
            })
            audit.scan_status_detail = f"Analysing {question.id}…"
            db.commit()

            t0 = datetime.utcnow()
            log_step(db, audit_id, "prompt_sent",
                     domain_id    = domain.id,
                     question_id  = question.id,
                     input_summary= f"{question.text[:200]}",
                     metadata     = {"evidence_file_count": len(ev_chunks)})

            # analyze_question uses groq_call_with_retry internally
            verdict = analyze_question(
                domain_id     = domain.id,
                domain_name   = domain.name,
                key_controls  = domain.key_controls,
                keywords      = domain.keywords,
                question_id   = question.id,
                question_text = question.text,
                evidence_chunks = ev_chunks,
            )
            duration = int((datetime.utcnow() - t0).total_seconds() * 1000)

            # Persist result
            result = AuditResult(
                audit_id           = audit_id,
                domain_id          = domain.id,
                question_id        = question.id,
                question_text      = question.text,
                verdict            = verdict.verdict,
                confidence_score   = verdict.confidence_score,
                context_summary    = verdict.context_summary,
                evidence_analysis  = json.dumps(verdict.evidence_analysis),
                identified_gaps    = json.dumps(verdict.gaps),
                conclusion         = verdict.conclusion,
                evidence_refs      = json.dumps([
                    {"file_id": c["file_id"], "filename": c["filename"]}
                    for c in ev_chunks if not c.get("truncated")
                ]),
                matched_controls   = json.dumps(verdict.matched_controls),
                unmatched_controls = json.dumps(verdict.unmatched_controls),
            )
            db.add(result)

            if verdict.verdict == "compliant":
                compliant += 1
            elif verdict.verdict == "partial":
                partial += 1
            else:
                non_compliant += 1

            processed += 1
            audit.questions_processed = processed
            db.commit()

            log_step(
                db, audit_id, "verdict_assigned",
                domain_id         = domain.id,
                question_id       = question.id,
                output_summary    = f"verdict={verdict.verdict} confidence={verdict.confidence_score}",
                prompt_tokens     = verdict.prompt_tokens,
                completion_tokens = verdict.completion_tokens,
                model_used        = verdict.model_used,
                duration_ms       = duration,
            )

    # ── Step 4: Finalise audit ────────────────────────────────────────────────
    answered = compliant + partial + non_compliant
    overall  = round(((compliant + partial * 0.5) / answered * 100) if answered else 0, 1)

    audit.status              = "completed"
    audit.completed_at        = datetime.utcnow()
    audit.overall_score       = overall
    audit.compliant_count     = compliant
    audit.partial_count       = partial
    audit.non_compliant_count = non_compliant
    audit.questions_processed = answered
    audit.scan_status_detail  = "Completed"
    audit.config_snapshot     = json.dumps({"framework_version": get_framework().version})
    db.commit()

    logger.info(
        "Audit %s complete — score=%.1f%% (%dC/%dP/%dNC)",
        audit_id, overall, compliant, partial, non_compliant,
    )
