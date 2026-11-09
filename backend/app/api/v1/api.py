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

import json
import logging
from pathlib import Path
from sqlalchemy import text
from app.core.database import SessionLocal

logger = logging.getLogger("bricdoc.health")

@api_router.get("/health")
def api_v1_health():
    """
    Public API v1 health check endpoint reporting live system status.
    Verifies process, database, redis, and storage connectivity without leaking credentials.
    """
    # 1. Check Database connectivity
    db_status = "unavailable"
    db_session = None
    try:
        db_session = SessionLocal()
        db_session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Health check DB probe error: {e}")
        db_status = "error"
    finally:
        if db_session:
            db_session.close()

    # 2. Check Storage accessibility & metrics
    storage_status = "accessible"
    storage_metrics = {}
    try:
        total, used, free = shutil.disk_usage(settings.STORAGE_DIR)
        storage_metrics = {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2)
        }
    except Exception:
        storage_status = "degraded"

    # 3. Check Redis connectivity
    redis_status = "not_configured"
    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=2)
            if r.ping():
                redis_status = "connected"
            else:
                redis_status = "degraded"
        except Exception:
            redis_status = "unavailable"

    # 4. Check Background Worker heartbeat
    worker_status = "standby"
    try:
        hb_file = Path(settings.STORAGE_DIR) / "worker_heartbeat.json"
        if hb_file.exists():
            hb_data = json.loads(hb_file.read_text())
            worker_status = "active"
    except Exception:
        pass

    overall_status = "healthy" if db_status == "connected" and storage_status == "accessible" else "degraded"

    return {
        "status": overall_status,
        "service": "BricDoc API",
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "database": db_status,
            "storage": storage_status,
            "redis": redis_status,
            "worker": worker_status
        },
        "storage": storage_metrics
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
