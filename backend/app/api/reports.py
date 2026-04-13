"""
Report generation and export endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.audit import Audit
from ..schemas.report import AuditReport
from ..services.report_generator import build_report, report_to_csv, report_to_html

router = APIRouter(prefix="/audits", tags=["reports"])


@router.get("/{audit_id}/report", response_model=AuditReport)
def get_report_json(audit_id: str, db: Session = Depends(get_db)):
    _require_completed(audit_id, db)
    return build_report(db, audit_id)


@router.get("/{audit_id}/report/html", response_class=HTMLResponse)
def get_report_html(audit_id: str, db: Session = Depends(get_db)):
    _require_completed(audit_id, db)
    report = build_report(db, audit_id)
    html = report_to_html(report)
    return HTMLResponse(content=html, media_type="text/html")


@router.get("/{audit_id}/report/csv")
def get_report_csv(audit_id: str, db: Session = Depends(get_db)):
    _require_completed(audit_id, db)
    report = build_report(db, audit_id)
    csv_content = report_to_csv(report)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="audit_{audit_id[:8]}.csv"'},
    )


def _require_completed(audit_id: str, db: Session) -> Audit:
    audit = db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if audit.status != "completed":
        raise HTTPException(409, f"Audit status is '{audit.status}'. Reports available only for completed audits.")
    return audit
