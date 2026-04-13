"""
Audit trail service — logs every reasoning step for reproducibility.
"""
from __future__ import annotations
import json
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from ..models.audit_log import AuditTrailEntry


def log_step(
    db: Session,
    audit_id: str,
    step_type: str,
    *,
    domain_id: Optional[str] = None,
    question_id: Optional[str] = None,
    evidence_file_id: Optional[str] = None,
    input_summary: Optional[str] = None,
    output_summary: Optional[str] = None,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    model_used: Optional[str] = None,
    duration_ms: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuditTrailEntry:
    entry = AuditTrailEntry(
        audit_id=audit_id,
        timestamp=datetime.utcnow(),
        step_type=step_type,
        domain_id=domain_id,
        question_id=question_id,
        evidence_file_id=evidence_file_id,
        input_summary=_truncate(input_summary, 1000),
        output_summary=_truncate(output_summary, 1000),
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        model_used=model_used,
        duration_ms=duration_ms,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    db.commit()
    return entry


def _truncate(text: Optional[str], max_len: int) -> Optional[str]:
    if text is None:
        return None
    if len(text) <= max_len:
        return text
    return text[:max_len] + "...[truncated]"
