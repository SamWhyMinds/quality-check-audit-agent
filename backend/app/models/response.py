"""
ORM models for the Quality Check Audit respond + review workflow.

Two-stage flow:
  Stage 1 — Vendor Response:  vendor fills user_response + uploads evidence → submits
  Stage 2 — Client Review:    client reviews vendor response + triggers AI validation → approves/rejects

Status progression:
  draft → submitted → validated → approved | rejected
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class QuestionResponse(Base):
    __tablename__ = "question_responses"

    id = Column(String, primary_key=True, default=_uuid)
    audit_id = Column(String, ForeignKey("audits.id", ondelete="CASCADE"), nullable=False)
    domain_id = Column(String, nullable=False)       # "D01"
    question_id = Column(String, nullable=False)     # "D01_Q01"
    question_text = Column(Text, nullable=False)

    # ── Stage 1: Vendor Response ──────────────────────────────────────────
    user_response = Column(Text)         # Single combined response field
    vendor_submitted_at = Column(DateTime)

    # Status: "draft" | "submitted" | "validated" | "approved" | "rejected"
    status = Column(String, default="draft")

    # ── Stage 2: AI Validation (triggered by client) ──────────────────────
    ai_verdict = Column(String)                  # compliant | partial | non_compliant
    ai_confidence_score = Column(Float)
    ai_validation_summary = Column(Text)
    ai_answer_assessment = Column(Text)
    ai_justification_assessment = Column(Text)
    ai_evidence_assessments = Column(Text)       # JSON: per-file findings
    ai_gaps = Column(Text)                       # JSON: list of all gaps
    ai_significant_gaps = Column(Text)           # JSON: critical/blocking gaps
    ai_recommendation = Column(Text)
    ai_model_used = Column(String)
    validated_at = Column(DateTime)

    # ── Stage 2: Client Review Decision ──────────────────────────────────
    client_verdict = Column(String)              # "approved" | "rejected"
    client_notes = Column(Text)
    client_reviewed_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    evidence_files = relationship(
        "ResponseEvidence",
        back_populates="response",
        cascade="all, delete-orphan",
    )


class ResponseEvidence(Base):
    __tablename__ = "response_evidence"

    id = Column(String, primary_key=True, default=_uuid)
    response_id = Column(String, ForeignKey("question_responses.id", ondelete="CASCADE"), nullable=False)
    audit_id = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size_bytes = Column(Integer)
    upload_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    extracted_text = Column(Text)
    extraction_method = Column(String)
    extraction_error = Column(Text)

    response = relationship("QuestionResponse", back_populates="evidence_files")
