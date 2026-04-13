"""
Report generator — assembles audit results into structured outputs.
Supports JSON, HTML (Jinja2), and CSV.
"""
from __future__ import annotations
import json
import csv
import io
from datetime import datetime
from typing import List
from jinja2 import Template
from sqlalchemy.orm import Session

from ..models.audit import Audit, AuditResult
from ..schemas.report import AuditReport, DomainReport, QuestionReport
from .framework_engine import get_domain, get_framework


def build_report(db: Session, audit_id: str) -> AuditReport:
    audit = db.get(Audit, audit_id)
    if not audit:
        raise ValueError(f"Audit {audit_id} not found")

    results = db.query(AuditResult).filter_by(audit_id=audit_id).order_by(
        AuditResult.domain_id, AuditResult.question_id
    ).all()

    # Group by domain
    domain_results: dict[str, List[AuditResult]] = {}
    for r in results:
        domain_results.setdefault(r.domain_id, []).append(r)

    domain_reports = []
    for domain_id, dresults in sorted(domain_results.items()):
        domain = get_domain(domain_id)
        domain_name = domain.name if domain else domain_id

        questions = []
        for r in dresults:
            questions.append(QuestionReport(
                question_id=r.question_id,
                question_text=r.question_text,
                verdict=r.verdict,
                confidence_score=r.confidence_score,
                context_summary=r.context_summary,
                evidence_analysis=_load_json(r.evidence_analysis),
                identified_gaps=_load_json(r.identified_gaps),
                matched_controls=_load_json(r.matched_controls),
                unmatched_controls=_load_json(r.unmatched_controls),
                conclusion=r.conclusion,
                evidence_refs=_load_json(r.evidence_refs),
            ))

        c = sum(1 for q in questions if q.verdict == "compliant")
        p = sum(1 for q in questions if q.verdict == "partial")
        nc = sum(1 for q in questions if q.verdict == "non_compliant")
        total = len(questions)
        score = round(((c + p * 0.5) / total * 100) if total else 0, 1)

        domain_reports.append(DomainReport(
            domain_id=domain_id,
            domain_name=domain_name,
            questions=questions,
            domain_score=score,
            compliant_count=c,
            partial_count=p,
            non_compliant_count=nc,
        ))

    return AuditReport(
        audit_id=audit.id,
        audit_name=audit.name,
        generated_at=datetime.utcnow(),
        overall_score=audit.overall_score or 0.0,
        total_questions=audit.total_questions,
        compliant_count=audit.compliant_count,
        partial_count=audit.partial_count,
        non_compliant_count=audit.non_compliant_count,
        domains=domain_reports,
        framework_version=get_framework().version,
    )


def report_to_csv(report: AuditReport) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Domain ID", "Domain Name", "Question ID", "Question",
        "Verdict", "Confidence Score", "Gaps", "Conclusion"
    ])
    for domain in report.domains:
        for q in domain.questions:
            gaps = "; ".join(q.identified_gaps or [])
            writer.writerow([
                domain.domain_id, domain.domain_name, q.question_id,
                q.question_text, q.verdict, q.confidence_score, gaps,
                (q.conclusion or "")[:300]
            ])
    return output.getvalue()


def report_to_html(report: AuditReport) -> str:
    return _HTML_TEMPLATE.render(report=report, now=datetime.utcnow())


def _load_json(value):
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return []


_HTML_TEMPLATE = Template("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Audit Report — {{ report.audit_name }}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
  .header { background: #1e3a5f; color: white; padding: 24px 40px; }
  .header h1 { margin: 0 0 4px; font-size: 24px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .summary { display: flex; gap: 20px; padding: 20px 40px; background: #f5f7fa; border-bottom: 1px solid #e0e0e0; }
  .stat { text-align: center; background: white; border-radius: 8px; padding: 16px 24px; min-width: 120px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .stat .value { font-size: 32px; font-weight: bold; }
  .stat .label { font-size: 12px; color: #666; margin-top: 4px; }
  .compliant .value { color: #16a34a; }
  .partial .value { color: #ca8a04; }
  .non-compliant .value { color: #dc2626; }
  .score .value { color: #1e3a5f; }
  .content { padding: 24px 40px; }
  .domain { margin-bottom: 32px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .domain-header { background: #1e3a5f; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
  .domain-header h2 { margin: 0; font-size: 16px; }
  .domain-score { font-size: 20px; font-weight: bold; }
  .question { padding: 16px 20px; border-top: 1px solid #e0e0e0; }
  .question-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .question-text { font-weight: 500; flex: 1; }
  .verdict-badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; white-space: nowrap; margin-left: 12px; }
  .verdict-compliant { background: #dcfce7; color: #16a34a; }
  .verdict-partial { background: #fef9c3; color: #92400e; }
  .verdict-non_compliant { background: #fee2e2; color: #dc2626; }
  .confidence { font-size: 12px; color: #666; margin-bottom: 8px; }
  .conclusion { font-size: 13px; color: #333; margin-bottom: 6px; }
  .gaps { margin-top: 6px; }
  .gap-item { font-size: 12px; color: #dc2626; }
  .gap-item::before { content: "⚠ "; }
  footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #e0e0e0; }
</style>
</head>
<body>
<div class="header">
  <h1>Audit Report: {{ report.audit_name }}</h1>
  <p>Generated: {{ report.generated_at.strftime('%Y-%m-%d %H:%M UTC') }} | Framework v{{ report.framework_version }} | Audit ID: {{ report.audit_id }}</p>
</div>
<div class="summary">
  <div class="stat score"><div class="value">{{ report.overall_score }}%</div><div class="label">Overall Score</div></div>
  <div class="stat compliant"><div class="value">{{ report.compliant_count }}</div><div class="label">Compliant</div></div>
  <div class="stat partial"><div class="value">{{ report.partial_count }}</div><div class="label">Partial</div></div>
  <div class="stat non-compliant"><div class="value">{{ report.non_compliant_count }}</div><div class="label">Non-Compliant</div></div>
  <div class="stat"><div class="value">{{ report.total_questions }}</div><div class="label">Total Questions</div></div>
</div>
<div class="content">
{% for domain in report.domains %}
<div class="domain">
  <div class="domain-header">
    <h2>{{ domain.domain_id }}: {{ domain.domain_name }}</h2>
    <span class="domain-score">{{ domain.domain_score }}%</span>
  </div>
  {% for q in domain.questions %}
  <div class="question">
    <div class="question-header">
      <div class="question-text">{{ q.question_id }}: {{ q.question_text }}</div>
      <span class="verdict-badge verdict-{{ q.verdict }}">{{ q.verdict.replace('_', ' ').title() }}</span>
    </div>
    <div class="confidence">Confidence: {{ q.confidence_score | int }}%</div>
    {% if q.conclusion %}<div class="conclusion">{{ q.conclusion }}</div>{% endif %}
    {% if q.identified_gaps %}
    <div class="gaps">
      {% for gap in q.identified_gaps %}<div class="gap-item">{{ gap }}</div>{% endfor %}
    </div>
    {% endif %}
  </div>
  {% endfor %}
</div>
{% endfor %}
</div>
<footer>Audit Agent &mdash; Powered by Claude AI &mdash; Framework: 19 Domains, 95 Audit Questions</footer>
</body>
</html>""")
