"""
ORM models for audits, evidence files, evidence-domain mapping, and audit results.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Audit(Base):
    __tablename__ = "audits"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, nullable=False, default="pending")
    # "pending" | "running" | "completed" | "failed"
    selected_domains = Column(Text, nullable=False)  # JSON array ["D01","D02",...]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    overall_score = Column(Float)  # 0–100
    total_questions = Column(Integer, default=0)
    compliant_count = Column(Integer, default=0)
    partial_count = Column(Integer, default=0)
    non_compliant_count = Column(Integer, default=0)
    config_snapshot = Column(Text)   # JSON snapshot of framework version used
    # Checkpoint / progress tracking (enables resume after rate-limit pause)
    questions_processed = Column(Integer, default=0)
    last_checkpoint     = Column(Text)    # JSON: {"domain_id":"D03","question_id":"D03_Q02"}
    scan_status_detail  = Column(Text)    # e.g. "rate_limited — retrying in 65s"

    evidence_files = relationship("EvidenceFile", back_populates="audit", cascade="all, delete-orphan")
    results = relationship("AuditResult", back_populates="audit", cascade="all, delete-orphan")
    trail = relationship("AuditTrailEntry", back_populates="audit", cascade="all, delete-orphan")


class EvidenceFile(Base):
    __tablename__ = "evidence_files"

    id = Column(String, primary_key=True, default=_uuid)
    audit_id = Column(String, ForeignKey("audits.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)  # UUID-named on disk
    file_type = Column(String, nullable=False)  # docx|xlsx|csv|pdf|png|jpeg
    file_size_bytes = Column(Integer)
    upload_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    extracted_text = Column(Text)
    extraction_method = Column(String)
    extraction_error = Column(Text)
    page_count = Column(Integer)
    sheet_names = Column(Text)  # JSON array for xlsx
    text_hash = Column(String)  # SHA-256 of extracted_text

    audit = relationship("Audit", back_populates="evidence_files")
    domain_mappings = relationship("EvidenceDomainMapping", back_populates="evidence_file", cascade="all, delete-orphan")


class EvidenceDomainMapping(Base):
    __tablename__ = "evidence_domain_mapping"

    id = Column(String, primary_key=True, default=_uuid)
    evidence_file_id = Column(String, ForeignKey("evidence_files.id", ondelete="CASCADE"), nullable=False)
    domain_id = Column(String, nullable=False)  # "D01"–"D19"
    match_score = Column(Float)  # 0–1
    matched_keywords = Column(Text)  # JSON array
    mapping_method = Column(String)  # "keyword" | "nlp"

    evidence_file = relationship("EvidenceFile", back_populates="domain_mappings")


class AuditResult(Base):
    __tablename__ = "audit_results"

    id = Column(String, primary_key=True, default=_uuid)
    audit_id = Column(String, ForeignKey("audits.id", ondelete="CASCADE"), nullable=False)
    domain_id = Column(String, nullable=False)
    question_id = Column(String, nullable=False)  # "D01_Q01"
    question_text = Column(Text, nullable=False)
    verdict = Column(String, nullable=False)  # compliant | partial | non_compliant
    confidence_score = Column(Float, nullable=False)  # 0–100
    context_summary = Column(Text)
    evidence_analysis = Column(Text)  # JSON array of per-file findings
    identified_gaps = Column(Text)  # JSON array
    conclusion = Column(Text)
    evidence_refs = Column(Text)  # JSON [{file_id, filename, location}]
    matched_controls = Column(Text)  # JSON array
    unmatched_controls = Column(Text)  # JSON array
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    audit = relationship("Audit", back_populates="results")
