"""
Evidence file upload and management endpoints.
"""
from __future__ import annotations
import hashlib
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models.audit import Audit, EvidenceFile, EvidenceDomainMapping
from ..parsers.registry import SUPPORTED_EXTENSIONS
from ..schemas.audit import EvidenceFileOut, EvidenceDomainMappingOut

router = APIRouter(prefix="/audits", tags=["evidence"])

ALLOWED_EXTENSIONS = {".docx", ".xlsx", ".xlsm", ".csv", ".pdf", ".png", ".jpg", ".jpeg"}


@router.post("/{audit_id}/evidence", response_model=List[EvidenceFileOut], status_code=201)
async def upload_evidence(
    audit_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if audit.status in ("running", "completed"):
        raise HTTPException(409, "Cannot upload files to an audit that is running or completed")

    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    created = []

    for upload in files:
        ext = Path(upload.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {sorted(ALLOWED_EXTENSIONS)}")

        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(413, f"{upload.filename} exceeds {settings.max_upload_size_mb}MB limit")

        stored_name = f"{uuid.uuid4()}{ext}"
        stored_path = os.path.join(settings.upload_dir, stored_name)
        with open(stored_path, "wb") as f:
            f.write(content)

        ef = EvidenceFile(
            audit_id=audit_id,
            original_filename=upload.filename or stored_name,
            stored_filename=stored_name,
            file_type=ext.lstrip("."),
            file_size_bytes=len(content),
        )
        db.add(ef)
        db.commit()
        db.refresh(ef)
        created.append(_ef_out(ef))

    return created


@router.get("/{audit_id}/evidence", response_model=List[EvidenceFileOut])
def list_evidence(audit_id: str, db: Session = Depends(get_db)):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    files = db.query(EvidenceFile).filter_by(audit_id=audit_id).all()
    return [_ef_out(ef) for ef in files]


@router.get("/{audit_id}/evidence/{file_id}", response_model=EvidenceFileOut)
def get_evidence_file(audit_id: str, file_id: str, db: Session = Depends(get_db)):
    ef = db.query(EvidenceFile).filter_by(audit_id=audit_id, id=file_id).first()
    if not ef:
        raise HTTPException(404, "Evidence file not found")
    return _ef_out(ef, include_preview=True)


@router.delete("/{audit_id}/evidence/{file_id}", status_code=204)
def delete_evidence(audit_id: str, file_id: str, db: Session = Depends(get_db)):
    ef = db.query(EvidenceFile).filter_by(audit_id=audit_id, id=file_id).first()
    if not ef:
        raise HTTPException(404, "Evidence file not found")
    # Remove stored file
    stored_path = os.path.join(get_settings().upload_dir, ef.stored_filename)
    if os.path.exists(stored_path):
        os.remove(stored_path)
    db.delete(ef)
    db.commit()


@router.get("/{audit_id}/evidence-map", response_model=List[EvidenceDomainMappingOut])
def get_evidence_map(audit_id: str, db: Session = Depends(get_db)):
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    mappings = (
        db.query(EvidenceDomainMapping)
        .join(EvidenceFile)
        .filter(EvidenceFile.audit_id == audit_id)
        .all()
    )
    result = []
    for m in mappings:
        kws = []
        if m.matched_keywords:
            try:
                kws = json.loads(m.matched_keywords)
            except Exception:
                pass
        result.append(EvidenceDomainMappingOut(
            evidence_file_id=m.evidence_file_id,
            domain_id=m.domain_id,
            match_score=m.match_score,
            matched_keywords=kws,
            mapping_method=m.mapping_method,
        ))
    return result


def _ef_out(ef: EvidenceFile, include_preview: bool = False) -> EvidenceFileOut:
    sheet_names = None
    if ef.sheet_names:
        try:
            sheet_names = json.loads(ef.sheet_names)
        except Exception:
            pass
    preview = None
    if include_preview and ef.extracted_text:
        preview = ef.extracted_text[:500]
    return EvidenceFileOut(
        id=ef.id,
        audit_id=ef.audit_id,
        original_filename=ef.original_filename,
        file_type=ef.file_type,
        file_size_bytes=ef.file_size_bytes,
        upload_time=ef.upload_time,
        extraction_method=ef.extraction_method,
        extraction_error=ef.extraction_error,
        page_count=ef.page_count,
        sheet_names=sheet_names,
        text_preview=preview,
    )
