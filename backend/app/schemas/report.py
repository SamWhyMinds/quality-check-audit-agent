"""
Pydantic schemas for report structures.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class QuestionReport(BaseModel):
    question_id: str
    question_text: str
    verdict: str
    confidence_score: float
    context_summary: Optional[str]
    evidence_analysis: Optional[List[Dict[str, Any]]]
    identified_gaps: Optional[List[str]]
    matched_controls: Optional[List[str]]
    unmatched_controls: Optional[List[str]]
    conclusion: Optional[str]
    evidence_refs: Optional[List[Dict[str, Any]]]


class DomainReport(BaseModel):
    domain_id: str
    domain_name: str
    questions: List[QuestionReport]
    domain_score: float  # % of questions compliant or partial
    compliant_count: int
    partial_count: int
    non_compliant_count: int


class AuditReport(BaseModel):
    audit_id: str
    audit_name: str
    generated_at: datetime
    overall_score: float
    total_questions: int
    compliant_count: int
    partial_count: int
    non_compliant_count: int
    domains: List[DomainReport]
    framework_version: str
