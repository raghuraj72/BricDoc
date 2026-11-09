"""
Job Queue Dispatcher Service.
Provides uniform interface to enqueue background document processing tasks
into Redis list and database records.
"""

import json
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job import ProcessingJob, JobEvent

logger = logging.getLogger("bricdoc.queue")


class JobQueue:
    @staticmethod
    def enqueue_job(
        db: Session,
        user_id: str,
        tool_name: str,
        input_file_name: Optional[str] = None
    ) -> ProcessingJob:
        """
        Creates a ProcessingJob record and pushes the job ID to Redis (if available).
        """
        job = ProcessingJob(
            user_id=user_id,
            tool_name=tool_name,
            status="queued",
            progress_percentage=0,
            input_file_name=input_file_name
        )
        db.add(job)
        db.flush()

        # Log initial event
        event = JobEvent(
            job_id=job.id,
            message=f"Job for '{tool_name}' submitted to queue.",
            event_type="info"
        )
        db.add(event)
        db.commit()
        db.refresh(job)

        # Push to Redis queue if configured
        if settings.REDIS_URL:
            try:
                import redis
                r = redis.from_url(settings.REDIS_URL, decode_responses=True)
                r.lpush("bricdoc:jobs:queue", job.id)
                logger.info(f"Pushed job {job.id} to Redis queue.")
            except Exception as e:
                logger.warning(f"Could not push job {job.id} to Redis ({e}), relies on DB polling.")

        return job
