"""
Framework engine — provides query interface over the 19-domain framework.
Single source of truth loaded from domains.json.
"""
from __future__ import annotations
from typing import List, Optional
from ..framework.loader import load_framework, Domain, AuditQuestion, Framework


def get_framework() -> Framework:
    return load_framework()


def get_all_domains() -> List[Domain]:
    return load_framework().domains


def get_domain(domain_id: str) -> Optional[Domain]:
    for d in load_framework().domains:
        if d.id == domain_id:
            return d
    return None


def get_domains_by_ids(ids: List[str]) -> List[Domain]:
    fw = load_framework()
    id_set = set(ids)
    return [d for d in fw.domains if d.id in id_set]


def get_questions_for_domain(domain_id: str) -> List[AuditQuestion]:
    domain = get_domain(domain_id)
    return domain.audit_questions if domain else []


def get_question(question_id: str) -> Optional[tuple[Domain, AuditQuestion]]:
    """Returns (domain, question) tuple or None."""
    for domain in load_framework().domains:
        for q in domain.audit_questions:
            if q.id == question_id:
                return (domain, q)
    return None


def search_keywords(text: str, top_n: int = 5) -> List[tuple[str, float]]:
    """
    Score each domain against the provided text using keyword overlap.
    Returns list of (domain_id, score) sorted by score descending.
    Score = matched_keywords / total_keywords (simple overlap ratio).
    """
    text_lower = text.lower()
    scores = []
    for domain in load_framework().domains:
        if not domain.keywords:
            continue
        matches = sum(1 for kw in domain.keywords if kw.lower() in text_lower)
        score = matches / len(domain.keywords)
        if score > 0:
            scores.append((domain.id, score))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n]


def get_all_evidence_types() -> List[str]:
    return load_framework().evidence_types
