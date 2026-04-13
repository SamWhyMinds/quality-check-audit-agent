"""
Pydantic schemas for framework domain/question responses.
"""
from typing import List, Optional
from pydantic import BaseModel


class AuditQuestionOut(BaseModel):
    id: str
    text: str
    focus_controls: List[str]
    evidence_types: List[str]
    domain_id: Optional[str] = None
    domain_name: Optional[str] = None


class DomainSummaryOut(BaseModel):
    id: str
    name: str
    question_count: int
    keywords: List[str]
    relevant_evidence_types: List[str]


class DomainDetailOut(BaseModel):
    id: str
    name: str
    key_controls: List[str]
    keywords: List[str]
    audit_questions: List[AuditQuestionOut]
    relevant_evidence_types: List[str]


class FrameworkSummaryOut(BaseModel):
    version: str
    title: str
    domain_count: int
    total_questions: int
    domains: List[DomainSummaryOut]
