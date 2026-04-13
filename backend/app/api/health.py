from fastapi import APIRouter
from ..config import get_settings
from ..services.framework_engine import get_framework

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config")
def config():
    s = get_settings()
    fw = get_framework()
    return {
        "claude_model": s.claude_model,
        "framework_version": fw.version,
        "framework_title": fw.title,
        "total_domains": len(fw.domains),
        "total_questions": fw.total_questions,
    }
