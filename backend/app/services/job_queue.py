"""
Job Queue Dispatcher Service.
Provides uniform interface to enqueue background document processing tasks
into Redis list and database records.
"""

import json
import logging
from typing import Optional, Dict, Any, Union
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
        input_file_name: Optional[str] = None,
        parameters: Optional[Union[Dict[str, Any], str]] = None
    ) -> ProcessingJob:
        """
        Creates a ProcessingJob record with optional tool parameters
        and pushes the job ID to Redis queue (if available) with DB fallback.
        """
        param_str = None
        if parameters is not None:
            if isinstance(parameters, dict):
                param_str = json.dumps(parameters)
            elif isinstance(parameters, str) and parameters.strip():
                # Validate JSON format
                try:
                    parsed = json.loads(parameters)
                    param_str = json.dumps(parsed)
                except Exception:
                    param_str = json.dumps({"raw": parameters})

        job = ProcessingJob(
            user_id=user_id,
            tool_name=tool_name,
            status="queued",
            progress_percentage=0,
            input_file_name=input_file_name,
            parameters=param_str
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
