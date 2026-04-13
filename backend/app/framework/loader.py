"""
Loads and validates domains.json at startup.
"""
from __future__ import annotations
import json
from pathlib import Path
from functools import lru_cache
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AuditQuestion:
    id: str
    text: str
    focus_controls: List[str]
    evidence_types: List[str]


@dataclass
class Domain:
    id: str
    name: str
    key_controls: List[str]
    keywords: List[str]
    audit_questions: List[AuditQuestion]
    relevant_evidence_types: List[str]


@dataclass
class Framework:
    version: str
    title: str
    domains: List[Domain]
    evidence_types: List[str]

    @property
    def total_questions(self) -> int:
        return sum(len(d.audit_questions) for d in self.domains)


@lru_cache(maxsize=1)
def load_framework() -> Framework:
    domains_json = Path(__file__).parent / "domains.json"
    with open(domains_json, encoding="utf-8") as f:
        data = json.load(f)

    domains = []
    for d in data["domains"]:
        questions = [
            AuditQuestion(
                id=q["id"],
                text=q["text"],
                focus_controls=q.get("focus_controls", []),
                evidence_types=q.get("evidence_types", []),
            )
            for q in d["audit_questions"]
        ]
        domains.append(Domain(
            id=d["id"],
            name=d["name"],
            key_controls=d.get("key_controls", []),
            keywords=d.get("keywords", []),
            audit_questions=questions,
            relevant_evidence_types=d.get("relevant_evidence_types", []),
        ))

    return Framework(
        version=data.get("version", "1.0.0"),
        title=data.get("title", ""),
        domains=domains,
        evidence_types=data.get("evidence_types", []),
    )
