"""
ORM model for the audit trail — every reasoning step logged.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class AuditTrailEntry(Base):
    __tablename__ = "audit_trail"

    id = Column(String, primary_key=True, default=_uuid)
    audit_id = Column(String, ForeignKey("audits.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    step_type = Column(String, nullable=False)
    # file_parsed | evidence_mapped | prompt_sent | response_received | verdict_assigned | error
    domain_id = Column(String)
    question_id = Column(String)
    evidence_file_id = Column(String)
    input_summary = Column(Text)   # Truncated prompt or file ref
    output_summary = Column(Text)  # Truncated response or result
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    model_used = Column(String)
    duration_ms = Column(Integer)
    metadata_json = Column(Text)   # JSON blob for extra context

    audit = relationship("Audit", back_populates="trail")
