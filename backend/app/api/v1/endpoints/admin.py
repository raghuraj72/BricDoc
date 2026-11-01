import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.job import ProcessingJob
from app.models.audit import AuditLog

router = APIRouter()

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )
    return current_user

@router.get("/health")
def system_health():
    """Public system health check endpoint."""
    total, used, free = shutil.disk_usage(settings.STORAGE_DIR)
    return {
        "status": "healthy",
        "service": "BricDoc API",
        "version": settings.VERSION,
        "storage": {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2)
        }
    }

@router.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """System-wide operational metrics for administrator."""
    user_count = db.query(func.count(User.id)).scalar()
    doc_count = db.query(func.count(Document.id)).scalar()
    total_bytes = db.query(func.sum(Document.file_size_bytes)).scalar() or 0
    job_count = db.query(func.count(ProcessingJob.id)).scalar()

    return {
        "total_users": user_count,
        "total_documents": doc_count,
        "total_storage_bytes": total_bytes,
        "total_jobs_run": job_count
    }

@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Retrieve system security audit trail."""
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
