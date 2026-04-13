"""
Audit CRUD and control endpoints.
"""
from __future__ import annotations
import json
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.audit import Audit, AuditResult
from ..models.audit_log import AuditTrailEntry
from ..schemas.audit import (
    AuditCreate, AuditSummary, AuditResultOut, AuditStatusOut,
    AuditTrailEntryOut, PaginatedAudits
)
from ..services.audit_engine import run_audit

router = APIRouter(prefix="/audits", tags=["audits"])


def _parse_domains(raw: str) -> list:
    try:
        return json.loads(raw)
    except Exception:
        return []


def _audit_to_summary(audit: Audit) -> AuditSummary:
    return AuditSummary(
        id=audit.id,
        name=audit.name,
        description=audit.description,
        status=audit.status,
        selected_domains=_parse_domains(audit.selected_domains),
        created_at=audit.created_at,
        completed_at=audit.completed_at,
        overall_score=audit.overall_score,
        total_questions=audit.total_questions or 0,
        compliant_count=audit.compliant_count or 0,
        partial_count=audit.partial_count or 0,
        non_compliant_count=audit.non_compliant_count or 0,
    )


@router.post("", response_model=AuditSummary, status_code=201)
def create_audit(body: AuditCreate, db: Session = Depends(get_db)):
    audit = Audit(
        name=body.name,
        description=body.description,
        selected_domains=json.dumps(body.selected_domains),
        status="pending",
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return _audit_to_summary(audit)


@router.get("", response_model=PaginatedAudits)
def list_audits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Audit)
    if status:
        q = q.filter(Audit.status == status)
    total = q.count()
    items = q.order_by(Audit.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedAudits(
        total=total, page=page, page_size=page_size,
        items=[_audit_to_summary(a) for a in items]
    )


@router.get("/{audit_id}", response_model=AuditSummary)
def get_audit(audit_id: str, db: Session = Depends(get_db)):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    return _audit_to_summary(audit)


@router.delete("/{audit_id}", status_code=204)
def delete_audit(audit_id: str, db: Session = Depends(get_db)):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    db.delete(audit)
    db.commit()


@router.post("/{audit_id}/start", response_model=AuditStatusOut)
def start_audit(audit_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if audit.status == "running":
        raise HTTPException(409, "Audit already running")
    if audit.status == "completed":
        raise HTTPException(409, "Audit already completed. Create a new audit to re-run.")
    background_tasks.add_task(run_audit, audit_id)
    return AuditStatusOut(
        audit_id=audit_id, status="running",
        total_questions=0, completed_questions=0, percent_complete=0.0
    )


@router.get("/{audit_id}/status", response_model=AuditStatusOut)
def audit_status(audit_id: str, db: Session = Depends(get_db)):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    completed = db.query(AuditResult).filter_by(audit_id=audit_id).count()
    total = audit.total_questions or 0
    pct = round(completed / total * 100, 1) if total else 0.0
    return AuditStatusOut(
        audit_id=audit_id, status=audit.status,
        total_questions=total, completed_questions=completed,
        percent_complete=pct,
    )


@router.get("/{audit_id}/results", response_model=List[AuditResultOut])
def get_results(
    audit_id: str,
    domain: Optional[str] = None,
    verdict: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditResult).filter_by(audit_id=audit_id)
    if domain:
        q = q.filter(AuditResult.domain_id == domain.upper())
    if verdict:
        q = q.filter(AuditResult.verdict == verdict)
    results = q.order_by(AuditResult.domain_id, AuditResult.question_id).all()
    return [_result_out(r) for r in results]


@router.get("/{audit_id}/results/{question_id}", response_model=AuditResultOut)
def get_result(audit_id: str, question_id: str, db: Session = Depends(get_db)):
    result = db.query(AuditResult).filter_by(
        audit_id=audit_id, question_id=question_id
    ).first()
    if not result:
        raise HTTPException(404, "Result not found")
    return _result_out(result)


@router.get("/{audit_id}/trail", response_model=List[AuditTrailEntryOut])
def get_trail(audit_id: str, db: Session = Depends(get_db)):
    entries = db.query(AuditTrailEntry).filter_by(audit_id=audit_id).order_by(
        AuditTrailEntry.timestamp
    ).all()
    return entries


def _result_out(r: AuditResult) -> AuditResultOut:
    return AuditResultOut(
        id=r.id, audit_id=r.audit_id,
        domain_id=r.domain_id, question_id=r.question_id,
        question_text=r.question_text, verdict=r.verdict,
        confidence_score=r.confidence_score,
        context_summary=r.context_summary,
        evidence_analysis=_json(r.evidence_analysis),
        identified_gaps=_json(r.identified_gaps),
        conclusion=r.conclusion,
        evidence_refs=_json(r.evidence_refs),
        matched_controls=_json(r.matched_controls),
        unmatched_controls=_json(r.unmatched_controls),
        created_at=r.created_at,
    )


def _json(v):
    if v is None:
        return None
    if isinstance(v, (list, dict)):
        return v
    try:
        return json.loads(v)
    except Exception:
        return []
