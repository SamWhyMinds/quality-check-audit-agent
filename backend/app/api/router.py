from fastapi import APIRouter
from .health import router as health_router
from .framework import router as framework_router
from .audits import router as audits_router
from .evidence import router as evidence_router
from .reports import router as reports_router
from .responses import router as responses_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(framework_router)
api_router.include_router(audits_router)
api_router.include_router(evidence_router)
api_router.include_router(reports_router)
api_router.include_router(responses_router)
