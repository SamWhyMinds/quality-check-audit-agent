"""
Pydantic schemas for Quality Check Audit — unified single-stage workflow.
Edit response + upload evidence + run AI analysis anytime (fully re-submittable).
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


# ── Evidence file ─────────────────────────────────────────────────────────────

class ResponseEvidenceOut(BaseModel):
    id: str
    response_id: str
    original_filename: str
    file_type: str
    file_size_bytes: Optional[int]
    upload_time: datetime
    extraction_method: Optional[str]
    extraction_error: Optional[str]

    model_config = {"from_attributes": True}


# ── Save / update response ────────────────────────────────────────────────────

class SaveResponse(BaseModel):
    """Save (or update) the justification text. Always allowed, no locking."""
    user_response: str = Field(..., min_length=1, description="Justification / compliance response")


# ── AI evidence assessment ────────────────────────────────────────────────────

class EvidenceAssessment(BaseModel):
    filename: str
    relevant: bool
    supports_answer: bool
    notes: str


# ── Full response object ──────────────────────────────────────────────────────

class QuestionResponseOut(BaseModel):
    id: str
    audit_id: str
    domain_id: str
    question_id: str
    question_text: str

    user_response: Optional[str]
    status: str   # not_started | draft | analysed

    # AI analysis results
    ai_verdict: Optional[str]
    ai_confidence_score: Optional[float]
    ai_validation_summary: Optional[str]
    ai_answer_assessment: Optional[str]
    ai_justification_assessment: Optional[str]
    ai_evidence_assessments: Optional[List[Any]]
    ai_gaps: Optional[List[str]]
    ai_significant_gaps: Optional[List[str]]
    ai_recommendation: Optional[str]
    ai_model_used: Optional[str]
    validated_at: Optional[datetime]

    created_at: datetime
    updated_at: Optional[datetime]
    evidence_files: List[ResponseEvidenceOut] = []

    model_config = {"from_attributes": True}


# ── Question list items ───────────────────────────────────────────────────────

class QuestionStatusItem(BaseModel):
    question_id: str
    domain_id: str
    domain_name: str
    question_text: str
    focus_controls: List[str]
    evidence_types: List[str]
    response_status: str          # not_started | draft | analysed
    ai_verdict: Optional[str]
    ai_confidence_score: Optional[float]
    response_id: Optional[str]
    evidence_count: int


class DomainQuestionList(BaseModel):
    domain_id: str
    domain_name: str
    questions: List[QuestionStatusItem]
    total_count: int
    analysed_count: int
    draft_count: int
