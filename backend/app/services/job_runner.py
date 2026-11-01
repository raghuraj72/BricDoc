import asyncio
import concurrent.futures
from datetime import datetime, timezone
from typing import Callable, Any, Dict
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.job import ProcessingJob, JobEvent

executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

class JobRunner:
    """
    Background job execution manager.
    Runs document tasks asynchronously while recording real progress and events in the database.
    """

    @staticmethod
    def create_job(db: Session, user_id: str, tool_name: str, input_file_name: str) -> ProcessingJob:
        """Create and persist a new job in queued state."""
        job = ProcessingJob(
            user_id=user_id,
            tool_name=tool_name,
            input_file_name=input_file_name,
            status="queued",
            progress_percentage=0
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def add_event(db: Session, job_id: str, message: str, event_type: str = "info"):
        """Add an event record to job timeline."""
        evt = JobEvent(
            job_id=job_id,
            message=message,
            event_type=event_type,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(evt)
        db.commit()

    @staticmethod
    def run_in_background(job_id: str, task_func: Callable[[], Dict[str, Any]]):
        """Dispatches job function to the thread pool and updates database status."""
        def worker():
            db = SessionLocal()
            try:
                job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
                if not job:
                    return
                
                job.status = "processing"
                job.started_at = datetime.now(timezone.utc)
                job.progress_percentage = 20
                db.commit()
                JobRunner.add_event(db, job_id, "Processing started in background worker.")

                # Execute synchronous document workload
                result = task_func()

                job.status = "completed"
                job.progress_percentage = 100
                job.completed_at = datetime.now(timezone.utc)
                if result:
                    job.output_file_name = result.get("output_filename")
                    job.output_storage_path = result.get("storage_path")
                    job.output_size_bytes = result.get("output_size_bytes")
                db.commit()
                JobRunner.add_event(db, job_id, "Processing completed successfully.", "milestone")

            except Exception as e:
                db.rollback()
                job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.error_message = str(e)
                    job.completed_at = datetime.now(timezone.utc)
                    db.commit()
                    JobRunner.add_event(db, job_id, f"Processing failed: {str(e)}", "error")
            finally:
                db.close()

        executor.submit(worker)

job_runner = JobRunner()
