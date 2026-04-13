"""
Pydantic schemas for audit request/response payloads.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Create / Update ──────────────────────────────────────────────────────────

class AuditCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    selected_domains: List[str] = Field(default_factory=lambda: [f"D{i:02d}" for i in range(1, 20)])


class AuditStartRequest(BaseModel):
    pass  # No body needed — uses already-uploaded evidence


# ── Responses ─────────────────────────────────────────────────────────────────

class AuditSummary(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    selected_domains: List[str]
    created_at: datetime
    completed_at: Optional[datetime]
    overall_score: Optional[float]
    total_questions: int
    compliant_count: int
    partial_count: int
    non_compliant_count: int

    model_config = {"from_attributes": True}


class EvidenceFileOut(BaseModel):
    id: str
    audit_id: str
    original_filename: str
    file_type: str
    file_size_bytes: Optional[int]
    upload_time: datetime
    extraction_method: Optional[str]
    extraction_error: Optional[str]
    page_count: Optional[int]
    sheet_names: Optional[List[str]]
    text_preview: Optional[str] = None  # First 500 chars of extracted_text

    model_config = {"from_attributes": True}


class EvidenceDomainMappingOut(BaseModel):
    evidence_file_id: str
    domain_id: str
    match_score: Optional[float]
    matched_keywords: Optional[List[str]]
    mapping_method: Optional[str]

    model_config = {"from_attributes": True}


class AuditResultOut(BaseModel):
    id: str
    audit_id: str
    domain_id: str
    question_id: str
    question_text: str
    verdict: str
    confidence_score: float
    context_summary: Optional[str]
    evidence_analysis: Optional[list]
    identified_gaps: Optional[List[str]]
    conclusion: Optional[str]
    evidence_refs: Optional[list]
    matched_controls: Optional[List[str]]
    unmatched_controls: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditStatusOut(BaseModel):
    audit_id: str
    status: str
    total_questions: int
    completed_questions: int
    percent_complete: float


class AuditTrailEntryOut(BaseModel):
    id: str
    timestamp: datetime
    step_type: str
    domain_id: Optional[str]
    question_id: Optional[str]
    evidence_file_id: Optional[str]
    input_summary: Optional[str]
    output_summary: Optional[str]
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    model_used: Optional[str]
    duration_ms: Optional[int]

    model_config = {"from_attributes": True}


class PaginatedAudits(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AuditSummary]
