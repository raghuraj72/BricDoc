from fastapi import APIRouter
import shutil
from datetime import datetime, timezone
from app.core.config import settings
from app.api.v1.endpoints import (
    auth,
    documents,
    tools,
    editor,
    ai,
    workflows,
    jobs,
    admin,
    subscription,
    payments
)

api_router = APIRouter()

@api_router.get("/health")
def api_v1_health():
    """Public API v1 health check endpoint reporting live system status."""
    total, used, free = shutil.disk_usage(settings.STORAGE_DIR)
    return {
        "status": "healthy",
        "service": "BricDoc API",
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "storage": {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2)
        }
    }

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents & Vault"])
api_router.include_router(tools.router, prefix="/tools", tags=["PDF Tools"])
api_router.include_router(editor.router, prefix="/editor", tags=["Document Editor"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Document Intelligence"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Custom Workflows"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Background Jobs"])
api_router.include_router(subscription.router, prefix="/subscription", tags=["Subscription & Usage"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payment Gateway"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration & Health"])
