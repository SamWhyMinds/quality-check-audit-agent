from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..schemas.framework import DomainSummaryOut, DomainDetailOut, AuditQuestionOut, FrameworkSummaryOut
from ..services.framework_engine import get_all_domains, get_domain, get_framework, get_all_evidence_types

router = APIRouter(prefix="/framework", tags=["framework"])


@router.get("", response_model=FrameworkSummaryOut)
def framework_summary():
    fw = get_framework()
    return FrameworkSummaryOut(
        version=fw.version,
        title=fw.title,
        domain_count=len(fw.domains),
        total_questions=fw.total_questions,
        domains=[
            DomainSummaryOut(
                id=d.id, name=d.name,
                question_count=len(d.audit_questions),
                keywords=d.keywords,
                relevant_evidence_types=d.relevant_evidence_types,
            )
            for d in fw.domains
        ]
    )


@router.get("/domains", response_model=List[DomainSummaryOut])
def list_domains():
    return [
        DomainSummaryOut(
            id=d.id, name=d.name,
            question_count=len(d.audit_questions),
            keywords=d.keywords,
            relevant_evidence_types=d.relevant_evidence_types,
        )
        for d in get_all_domains()
    ]


@router.get("/domains/{domain_id}", response_model=DomainDetailOut)
def get_domain_detail(domain_id: str):
    domain = get_domain(domain_id.upper())
    if not domain:
        raise HTTPException(status_code=404, detail=f"Domain {domain_id} not found")
    return DomainDetailOut(
        id=domain.id, name=domain.name,
        key_controls=domain.key_controls,
        keywords=domain.keywords,
        audit_questions=[
            AuditQuestionOut(
                id=q.id, text=q.text,
                focus_controls=q.focus_controls,
                evidence_types=q.evidence_types,
                domain_id=domain.id, domain_name=domain.name,
            )
            for q in domain.audit_questions
        ],
        relevant_evidence_types=domain.relevant_evidence_types,
    )


@router.get("/questions", response_model=List[AuditQuestionOut])
def list_questions(domain: Optional[str] = Query(None)):
    domains = get_all_domains()
    if domain:
        domains = [d for d in domains if d.id == domain.upper()]
    questions = []
    for d in domains:
        for q in d.audit_questions:
            questions.append(AuditQuestionOut(
                id=q.id, text=q.text,
                focus_controls=q.focus_controls,
                evidence_types=q.evidence_types,
                domain_id=d.id, domain_name=d.name,
            ))
    return questions


@router.get("/evidence-types", response_model=List[str])
def list_evidence_types():
    return get_all_evidence_types()
