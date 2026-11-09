from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import storage
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.job import ProcessingJob
from app.schemas.job import JobOut
from app.services.job_queue import JobQueue

router = APIRouter()

@router.post("/submit", response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
async def submit_job(
    tool_name: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits an asynchronous document processing job to the background worker queue.
    """
    input_path = None
    if file:
        input_path, _, _, _ = storage.save_upload(current_user.id, file)

    job = JobQueue.enqueue_job(
        db=db,
        user_id=current_user.id,
        tool_name=tool_name,
        input_file_name=input_path
    )
    return job

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

@router.get("/{job_id}/download")
def download_job_result(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Downloads the completed artifact produced by a background job."""
    job = db.query(ProcessingJob).filter(
        ProcessingJob.id == job_id,
        ProcessingJob.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != "completed" or not job.output_storage_path:
        raise HTTPException(status_code=400, detail=f"Job is not completed yet (current status: {job.status}).")

    abs_path = storage.get_absolute_path(job.output_storage_path)
    return FileResponse(
        path=str(abs_path),
        filename=job.output_file_name or "bricdoc_output.pdf",
        media_type="application/octet-stream"
    )
