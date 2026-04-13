"""
Quality Check Audit — Unified single-stage workflow API.

Every question supports:
  • Save/update justification at any time (no locking)
  • Upload / delete evidence at any time
  • Run AI analysis at any time (fully re-submittable)

Status: not_started → draft (has text) → analysed (AI ran)
Re-editing after analysis resets status to draft; analysis can be re-run freely.

Endpoints:
  GET    /api/audits/{id}/respond                         — list all questions + statuses
  GET    /api/audits/{id}/respond/{qid}                   — get single question response
  POST   /api/audits/{id}/respond/{qid}                   — save/update response
  POST   /api/audits/{id}/respond/{qid}/evidence          — upload evidence files
  DELETE /api/audits/{id}/respond/{qid}/evidence/{fid}    — delete evidence file
  POST   /api/audits/{id}/respond/{qid}/analyse           — run AI analysis
"""
from __future__ import annotations
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models.audit import Audit
from ..models.response import QuestionResponse, ResponseEvidence
from ..parsers.registry import parse_file
from ..schemas.response import (
    DomainQuestionList, QuestionResponseOut,
    QuestionStatusItem, ResponseEvidenceOut, SaveResponse,
)
from ..services.framework_engine import get_framework
from ..services.validator import validate_question_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audits", tags=["respond"])

ALLOWED_EXTENSIONS = {".docx", ".xlsx", ".xlsm", ".csv", ".pdf", ".png", ".jpg", ".jpeg"}

# Status values that count as "analysed"
ANALYSED_STATUSES = {"validated", "analysed", "approved", "rejected"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _audit_or_404(audit_id: str, db: Session) -> Audit:
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Session not found")
    return audit


def _response_or_none(audit_id: str, question_id: str, db: Session) -> QuestionResponse | None:
    return db.query(QuestionResponse).filter_by(
        audit_id=audit_id, question_id=question_id
    ).first()


def _j(v):
    if v is None:
        return None
    if isinstance(v, list):
        return v
    try:
        return json.loads(v)
    except Exception:
        return []


def _normalise_status(raw: str) -> str:
    """Normalise legacy statuses to the new simplified set."""
    if raw in ANALYSED_STATUSES:
        return "analysed"
    if raw == "draft":
        return "draft"
    return "not_started"


def _resp_out(r: QuestionResponse) -> QuestionResponseOut:
    return QuestionResponseOut(
        id=r.id,
        audit_id=r.audit_id,
        domain_id=r.domain_id,
        question_id=r.question_id,
        question_text=r.question_text,
        user_response=r.user_response,
        status=_normalise_status(r.status),
        ai_verdict=r.ai_verdict,
        ai_confidence_score=r.ai_confidence_score,
        ai_validation_summary=r.ai_validation_summary,
        ai_answer_assessment=r.ai_answer_assessment,
        ai_justification_assessment=r.ai_justification_assessment,
        ai_evidence_assessments=_j(r.ai_evidence_assessments),
        ai_gaps=_j(r.ai_gaps),
        ai_significant_gaps=_j(r.ai_significant_gaps),
        ai_recommendation=r.ai_recommendation,
        ai_model_used=r.ai_model_used,
        validated_at=r.validated_at,
        created_at=r.created_at,
        updated_at=r.updated_at,
        evidence_files=[
            ResponseEvidenceOut(
                id=ef.id,
                response_id=ef.response_id,
                original_filename=ef.original_filename,
                file_type=ef.file_type,
                file_size_bytes=ef.file_size_bytes,
                upload_time=ef.upload_time,
                extraction_method=ef.extraction_method,
                extraction_error=ef.extraction_error,
            )
            for ef in r.evidence_files
        ],
    )


# ── 1. List all questions with statuses ──────────────────────────────────────

@router.get("/{audit_id}/respond", response_model=List[DomainQuestionList])
def list_question_statuses(audit_id: str, db: Session = Depends(get_db)):
    _audit_or_404(audit_id, db)
    framework = get_framework()
    existing: dict[str, QuestionResponse] = {
        r.question_id: r
        for r in db.query(QuestionResponse).filter_by(audit_id=audit_id).all()
    }

    result = []
    for domain in framework.domains:
        questions = []
        analysed = draft = 0

        for q in domain.audit_questions:
            resp = existing.get(q.id)
            if resp is None:
                status = "not_started"
                ai_v = ai_c = rid = None
                ev = 0
            else:
                status = _normalise_status(resp.status)
                ai_v   = resp.ai_verdict
                ai_c   = resp.ai_confidence_score
                rid    = resp.id
                ev     = len(resp.evidence_files)
                if status == "analysed":
                    analysed += 1
                elif status == "draft":
                    draft += 1

            questions.append(QuestionStatusItem(
                question_id=q.id,
                domain_id=domain.id,
                domain_name=domain.name,
                question_text=q.text,
                focus_controls=q.focus_controls,
                evidence_types=q.evidence_types,
                response_status=status,
                ai_verdict=ai_v,
                ai_confidence_score=ai_c,
                response_id=rid,
                evidence_count=ev,
            ))

        result.append(DomainQuestionList(
            domain_id=domain.id,
            domain_name=domain.name,
            questions=questions,
            total_count=len(questions),
            analysed_count=analysed,
            draft_count=draft,
        ))

    return result


# ── 2. Get single question response ──────────────────────────────────────────

@router.get("/{audit_id}/respond/{question_id}", response_model=QuestionResponseOut)
def get_question_response(audit_id: str, question_id: str, db: Session = Depends(get_db)):
    _audit_or_404(audit_id, db)
    resp = _response_or_none(audit_id, question_id, db)
    if not resp:
        raise HTTPException(404, "No response yet for this question.")
    return _resp_out(resp)


# ── 3. Save / update justification (always allowed) ──────────────────────────

@router.post("/{audit_id}/respond/{question_id}", response_model=QuestionResponseOut)
def save_response(
    audit_id: str,
    question_id: str,
    body: SaveResponse,
    db: Session = Depends(get_db),
):
    _audit_or_404(audit_id, db)

    # Locate question in framework
    framework = get_framework()
    domain = question = None
    for d in framework.domains:
        for q in d.audit_questions:
            if q.id == question_id:
                domain = d; question = q; break
        if question:
            break
    if not question:
        raise HTTPException(404, f"Question {question_id} not found in framework")

    resp = _response_or_none(audit_id, question_id, db)
    if resp is None:
        resp = QuestionResponse(
            audit_id=audit_id,
            domain_id=domain.id,
            question_id=question_id,
            question_text=question.text,
            status="draft",
        )
        db.add(resp)

    resp.user_response = body.user_response
    resp.updated_at    = datetime.utcnow()

    # If re-editing after analysis, reset to draft (allows fresh re-analysis)
    if _normalise_status(resp.status) == "analysed":
        resp.status = "draft"
    else:
        resp.status = "draft"

    db.commit()
    db.refresh(resp)
    return _resp_out(resp)


# ── 4. Upload evidence (always allowed) ──────────────────────────────────────

@router.post(
    "/{audit_id}/respond/{question_id}/evidence",
    response_model=List[ResponseEvidenceOut],
    status_code=201,
)
async def upload_evidence(
    audit_id: str,
    question_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    _audit_or_404(audit_id, db)
    resp = _response_or_none(audit_id, question_id, db)
    if not resp:
        raise HTTPException(400, "Save a response first before uploading evidence.")

    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    created = []

    for upload in files:
        ext = Path(upload.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Unsupported file type: {ext}")

        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(413, f"{upload.filename} exceeds {settings.max_upload_size_mb} MB")

        stored_name = f"{uuid.uuid4()}{ext}"
        stored_path = os.path.join(settings.upload_dir, stored_name)
        with open(stored_path, "wb") as f:
            f.write(content)

        parsed = parse_file(stored_path)

        ef = ResponseEvidence(
            response_id=resp.id,
            audit_id=audit_id,
            original_filename=upload.filename or stored_name,
            stored_filename=stored_name,
            file_type=ext.lstrip("."),
            file_size_bytes=len(content),
            extracted_text=parsed.text_content,
            extraction_method=parsed.extraction_method,
            extraction_error=parsed.error,
        )
        db.add(ef)
        db.commit()
        db.refresh(ef)
        created.append(ResponseEvidenceOut(
            id=ef.id,
            response_id=ef.response_id,
            original_filename=ef.original_filename,
            file_type=ef.file_type,
            file_size_bytes=ef.file_size_bytes,
            upload_time=ef.upload_time,
            extraction_method=ef.extraction_method,
            extraction_error=ef.extraction_error,
        ))

    return created


# ── 5. Delete evidence (always allowed) ──────────────────────────────────────

@router.delete("/{audit_id}/respond/{question_id}/evidence/{file_id}", status_code=204)
def delete_evidence(
    audit_id: str,
    question_id: str,
    file_id: str,
    db: Session = Depends(get_db),
):
    _audit_or_404(audit_id, db)
    resp = _response_or_none(audit_id, question_id, db)
    if not resp:
        raise HTTPException(404, "Response not found")

    ef = db.query(ResponseEvidence).filter_by(id=file_id, response_id=resp.id).first()
    if not ef:
        raise HTTPException(404, "Evidence file not found")

    path = os.path.join(get_settings().upload_dir, ef.stored_filename)
    if os.path.exists(path):
        os.remove(path)
    db.delete(ef)
    db.commit()


# ── 6. Run AI analysis (always re-runnable) ───────────────────────────────────

@router.post("/{audit_id}/respond/{question_id}/analyse", response_model=QuestionResponseOut)
def run_analysis(
    audit_id: str,
    question_id: str,
    db: Session = Depends(get_db),
):
    _audit_or_404(audit_id, db)
    resp = _response_or_none(audit_id, question_id, db)
    if not resp or not resp.user_response or not resp.user_response.strip():
        raise HTTPException(400, "Save a justification response before running AI analysis.")

    # Locate question in framework
    framework = get_framework()
    domain = question = None
    for d in framework.domains:
        for q in d.audit_questions:
            if q.id == question_id:
                domain = d; question = q; break
        if question:
            break
    if not question:
        raise HTTPException(404, f"Question {question_id} not in framework")

    settings = get_settings()
    evidence_chunks = []
    for ef in resp.evidence_files:
        text = ef.extracted_text or ""
        if len(text) > settings.max_chars_per_file:
            text = text[:settings.max_chars_per_file] + "\n...[truncated]"
        evidence_chunks.append({
            "filename":  ef.original_filename,
            "file_type": ef.file_type,
            "text":      text,
        })

    result = validate_question_response(
        domain_id         = domain.id,
        domain_name       = domain.name,
        key_controls      = domain.key_controls,
        keywords          = domain.keywords,
        question_id       = question_id,
        question_text     = question.text,
        focus_controls    = question.focus_controls,
        evidence_types    = question.evidence_types,
        user_answer       = resp.user_response or "",
        user_justification= "",
        evidence_chunks   = evidence_chunks,
    )

    resp.ai_verdict                  = result.get("verdict")
    resp.ai_confidence_score         = result.get("confidence_score")
    resp.ai_validation_summary       = result.get("validation_summary")
    resp.ai_answer_assessment        = result.get("answer_assessment")
    resp.ai_justification_assessment = result.get("justification_assessment")
    resp.ai_evidence_assessments     = json.dumps(result.get("evidence_assessments", []))
    resp.ai_gaps                     = json.dumps(result.get("gaps", []))
    resp.ai_significant_gaps         = json.dumps(result.get("significant_gaps", []))
    resp.ai_recommendation           = result.get("recommendation")
    resp.ai_model_used               = result.get("model_used")
    resp.validated_at                = datetime.utcnow()
    resp.status                      = "analysed"
    resp.updated_at                  = datetime.utcnow()
    db.commit()
    db.refresh(resp)
    return _resp_out(resp)


# ── Legacy endpoint: /validate → redirects to /analyse ───────────────────────
# Keeps old frontend calls working if any remain

@router.post("/{audit_id}/respond/{question_id}/validate", response_model=QuestionResponseOut)
def run_analysis_legacy(
    audit_id: str,
    question_id: str,
    db: Session = Depends(get_db),
):
    return run_analysis(audit_id, question_id, db)
