"""
Maps parsed evidence files to audit domains via keyword scoring.
Returns a mapping: domain_id → list of (evidence_file_id, match_score, matched_keywords).
"""
from __future__ import annotations
import json
from typing import List, Dict, Tuple
from ..parsers.base import ParsedContent
from .framework_engine import search_keywords

# Minimum score to consider a file relevant to a domain
MIN_SCORE_THRESHOLD = 0.05


def map_evidence_to_domains(
    evidence_items: List[Tuple[str, ParsedContent]],
    # evidence_items: list of (evidence_file_id, ParsedContent)
    min_score: float = MIN_SCORE_THRESHOLD,
) -> Dict[str, List[Dict]]:
    """
    For each evidence file, score it against all 19 domains.
    Returns: { "D01": [{"file_id": ..., "score": ..., "keywords": [...]}], ... }
    """
    domain_map: Dict[str, List[Dict]] = {}

    for file_id, parsed in evidence_items:
        text = parsed.text_content or ""
        if not text or len(text.strip()) < 20:
            continue
        scores = search_keywords(text, top_n=19)
        for domain_id, score in scores:
            if score < min_score:
                continue
            # Find which keywords matched
            matched = _find_matched_keywords(text, domain_id)
            if domain_id not in domain_map:
                domain_map[domain_id] = []
            domain_map[domain_id].append({
                "file_id": file_id,
                "score": round(score, 4),
                "matched_keywords": matched,
                "method": "keyword",
            })

    # Sort each domain's evidence by score (highest first)
    for domain_id in domain_map:
        domain_map[domain_id].sort(key=lambda x: x["score"], reverse=True)

    return domain_map


def _find_matched_keywords(text: str, domain_id: str) -> List[str]:
    from .framework_engine import get_domain
    domain = get_domain(domain_id)
    if not domain:
        return []
    text_lower = text.lower()
    return [kw for kw in domain.keywords if kw.lower() in text_lower]


def get_evidence_for_domain(
    domain_id: str,
    domain_map: Dict[str, List[Dict]],
    evidence_lookup: Dict[str, ParsedContent],
    max_chars_per_file: int = 12000,
    max_total_chars: int = 120000,
) -> List[Dict]:
    """
    Returns evidence file chunks for a domain, ordered by relevance,
    respecting the total character budget.
    """
    entries = domain_map.get(domain_id, [])
    result = []
    total_chars = 0

    for entry in entries:
        fid = entry["file_id"]
        parsed = evidence_lookup.get(fid)
        if not parsed:
            continue
        text = parsed.text_content or ""
        chunk = text[:max_chars_per_file]
        truncated = len(text) > max_chars_per_file

        if total_chars + len(chunk) > max_total_chars:
            # Budget exceeded: add a placeholder
            result.append({
                "file_id": fid,
                "filename": parsed.filename,
                "file_type": parsed.file_type,
                "text": f"[{parsed.filename} — {round(entry['score']*100)}% relevance, omitted due to size budget]",
                "truncated": True,
                "score": entry["score"],
                "is_image": parsed.is_image,
                "image_data": None,
                "image_media_type": None,
            })
            continue

        total_chars += len(chunk)
        result.append({
            "file_id": fid,
            "filename": parsed.filename,
            "file_type": parsed.file_type,
            "text": chunk + ("\n...[truncated]" if truncated else ""),
            "truncated": truncated,
            "score": entry["score"],
            "is_image": parsed.is_image,
            "image_data": parsed.image_data if parsed.is_image else None,
            "image_media_type": parsed.image_media_type if parsed.is_image else None,
        })

    return result
