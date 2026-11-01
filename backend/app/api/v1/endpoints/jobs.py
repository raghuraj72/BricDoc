from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.job import ProcessingJob
from app.schemas.job import JobOut

router = APIRouter()

@router.get("", response_model=List[JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List recent background processing jobs for current user."""
    return db.query(ProcessingJob).filter(
        ProcessingJob.user_id == current_user.id
    ).order_by(ProcessingJob.created_at.desc()).limit(50).all()

@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get status and event timeline for a specific job."""
    job = db.query(ProcessingJob).filter(
        ProcessingJob.id == job_id,
        ProcessingJob.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job
