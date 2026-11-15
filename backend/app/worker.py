"""
BricDoc Production Background PDF Worker Service.
Processes asynchronous and long-running PDF transformation jobs from Redis / Database queues.
Supports standalone process execution (python -m app.worker) and in-process async worker execution
within the FastAPI application event loop for zero-cost hosting architectures.
"""

import os
import sys
import time
import json
import signal
import logging
import asyncio
import gc
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.storage import storage
from app.models.job import ProcessingJob, JobEvent
from app.services.pdf_processor import PDFProcessor
from app.services.pdf_converter import PDFConverter
from app.services.pdf_security import PDFSecurity
from app.services.pdf_ocr import PDFOCRService
from app.services.pdf_utilities import PDFUtilities

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [bricdoc-worker] %(message)s"
)
logger = logging.getLogger("bricdoc.worker")

# Global graceful shutdown flags
RUNNING = True
INPROCESS_WORKER_RUNNING = False


def signal_handler(signum, frame):
    global RUNNING, INPROCESS_WORKER_RUNNING
    logger.info(f"Received termination signal ({signum}). Initiating graceful shutdown...")
    RUNNING = False
    INPROCESS_WORKER_RUNNING = False


# Register signal handlers if in main thread
try:
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
except (ValueError, AttributeError):
    pass  # Not in main thread


class PDFWorker:
    """Production background worker for document processing."""

    def __init__(self):
        self.redis_client = None
        self._last_stalled_check = time.time()
        if settings.REDIS_URL:
            try:
                import redis
                self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
                self.redis_client.ping()
                logger.info("Connected to Redis queue successfully.")
            except Exception as e:
                logger.warning(f"Could not connect to Redis ({e}). Falling back to Database queue polling.")
                self.redis_client = None

    def emit_heartbeat(self):
        """Emits worker heartbeat timestamp to Redis or file for health probes."""
        timestamp_str = datetime.now(timezone.utc).isoformat()
        if self.redis_client:
            try:
                self.redis_client.set("bricdoc:worker:heartbeat", timestamp_str, ex=60)
            except Exception:
                pass

        # Local heartbeat fallback file
        try:
            hb_file = Path(settings.STORAGE_DIR) / "worker_heartbeat.json"
            hb_file.write_text(json.dumps({"status": "active", "timestamp": timestamp_str}))
        except Exception:
            pass

    def recover_stalled_jobs(self, db):
        """
        Recovers jobs stuck in 'processing' status for > 10 minutes
        due to worker crashes or container restarts.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=10)

        stalled_jobs = db.query(ProcessingJob).filter(
            ProcessingJob.status == "processing",
            ProcessingJob.started_at < cutoff
        ).all()

        for job in stalled_jobs:
            if (job.retry_count or 0) < 3:
                logger.warning(f"Requeueing stalled job {job.id} (tool: {job.tool_name}, attempts: {job.retry_count})")
                job.status = "queued"
                db.add(JobEvent(
                    job_id=job.id,
                    message="Job timed out or worker restarted; requeued for retry.",
                    event_type="warning"
                ))
                if self.redis_client:
                    try:
                        self.redis_client.lpush("bricdoc:jobs:queue", job.id)
                    except Exception:
                        pass
            else:
                logger.error(f"Failing stalled job {job.id} after exceeding 3 retries.")
                job.status = "failed"
                job.error_code = "JOB_TIMEOUT_EXCEEDED"
                job.error_message = "Job timed out and exceeded maximum retries."
                db.add(JobEvent(
                    job_id=job.id,
                    message="Job aborted: exceeded maximum timeout retries.",
                    event_type="error"
                ))
        if stalled_jobs:
            db.commit()

    def fetch_next_job(self, db) -> Optional[ProcessingJob]:
        """
        Retrieves the next queued job with atomic row claiming.
        Uses PostgreSQL SELECT FOR UPDATE SKIP LOCKED when running on Postgres.
        """
        # Periodic recovery of orphaned/stalled jobs (every 60 seconds)
        if time.time() - self._last_stalled_check > 60:
            self.recover_stalled_jobs(db)
            self._last_stalled_check = time.time()

        # If Redis is active, attempt pop first
        if self.redis_client:
            try:
                job_id = self.redis_client.rpop("bricdoc:jobs:queue")
                if job_id:
                    job = db.query(ProcessingJob).filter(
                        ProcessingJob.id == job_id,
                        ProcessingJob.status == "queued"
                    ).first()
                    if job:
                        job.status = "processing"
                        job.started_at = datetime.now(timezone.utc)
                        job.retry_count = (job.retry_count or 0) + 1
                        db.commit()
                        db.refresh(job)
                        return job
            except Exception as e:
                logger.error(f"Redis pop error: {e}")

        # Database queue polling with atomic claim
        try:
            is_postgres = db.bind and db.bind.dialect.name == "postgresql"
            query = db.query(ProcessingJob).filter(
                ProcessingJob.status == "queued"
            ).order_by(ProcessingJob.created_at.asc())

            if is_postgres:
                job = query.with_for_update(skip_locked=True).first()
            else:
                job = query.first()

            if job:
                job.status = "processing"
                job.started_at = datetime.now(timezone.utc)
                job.retry_count = (job.retry_count or 0) + 1
                db.commit()
                db.refresh(job)
                return job
        except Exception as e:
            logger.error(f"Database job fetch error: {e}")
            db.rollback()

        return None

    def execute_job(self, job: ProcessingJob, db):
        """Dispatches job to the appropriate PDF processing engine."""
        logger.info(f"Starting execution of job {job.id} (tool: {job.tool_name}) for user {job.user_id}")
        
        job.progress_percentage = 10
        db.add(JobEvent(job_id=job.id, message=f"Worker processing {job.tool_name}.", event_type="info"))
        db.commit()

        try:
            params = job.parsed_parameters

            # Resolve primary input file bytes from storage (with R2 cache-miss sync)
            input_bytes = None
            if job.input_file_name:
                try:
                    abs_path = storage.ensure_local_copy(job.input_file_name)
                    with open(abs_path, "rb") as f:
                        input_bytes = f.read()
                except Exception as e:
                    logger.error(f"Could not load input file {job.input_file_name}: {e}")
                    raise ValueError(f"Input document could not be retrieved from storage: {str(e)}")

            tool = (job.tool_name or "").lower().replace("-", "_")
            out_bytes = None
            out_name = f"{tool}_output.pdf"

            # ----------------- TOOL IMPLEMENTATIONS -----------------
            if tool == "merge":
                db.add(JobEvent(job_id=job.id, message="Executing PDF merge operation.", event_type="info"))
                job.progress_percentage = 40
                db.commit()

                # Collect all input files to merge
                merge_bytes_list: List[bytes] = []
                input_paths = params.get("input_files") or params.get("file_paths") or []
                if input_paths and isinstance(input_paths, list):
                    for path_str in input_paths:
                        p = storage.ensure_local_copy(path_str)
                        with open(p, "rb") as f:
                            merge_bytes_list.append(f.read())
                elif input_bytes:
                    merge_bytes_list.append(input_bytes)

                if not merge_bytes_list:
                    raise ValueError("At least one valid PDF document is required to merge.")

                out_bytes = PDFProcessor.merge_pdfs(merge_bytes_list)
                out_name = "bricdoc_merged.pdf"

            elif tool == "compress":
                if not input_bytes:
                    raise ValueError("Input PDF is required for compress operation.")
                db.add(JobEvent(job_id=job.id, message="Compressing PDF vector streams and images.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                level = params.get("level", "recommended")
                out_bytes = PDFProcessor.compress_pdf(input_bytes, level=level)
                out_name = "compressed_document.pdf"

            elif tool == "split":
                if not input_bytes:
                    raise ValueError("Input PDF is required for split operation.")
                db.add(JobEvent(job_id=job.id, message="Splitting PDF pages.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                range_str = params.get("range_str") or params.get("pages")
                if range_str:
                    out_bytes = PDFProcessor.split_pdf(input_bytes, range_str=str(range_str))
                    out_name = "split_selection.pdf"
                else:
                    pages = PDFProcessor.split_pdf(input_bytes)
                    out_bytes = PDFConverter.create_zip_archive(pages)
                    out_name = "split_pages.zip"

            elif tool in ("pdf_to_docx", "pdf_to_word"):
                if not input_bytes:
                    raise ValueError("Input PDF is required for conversion to Word.")
                db.add(JobEvent(job_id=job.id, message="Converting PDF layout to Word DOCX.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFConverter.pdf_to_docx(input_bytes)
                out_name = "converted_document.docx"

            elif tool in ("docx_to_pdf", "word_to_pdf"):
                if not input_bytes:
                    raise ValueError("Input Word DOCX is required for conversion to PDF.")
                db.add(JobEvent(job_id=job.id, message="Rendering Word DOCX to high-fidelity PDF.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFConverter.docx_to_pdf(input_bytes)
                out_name = "converted_document.pdf"

            elif tool == "pdf_to_excel":
                if not input_bytes:
                    raise ValueError("Input PDF is required for tabular extraction.")
                db.add(JobEvent(job_id=job.id, message="Extracting tabular structures to Excel.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFConverter.pdf_to_excel(input_bytes)
                out_name = "extracted_tables.xlsx"

            elif tool == "protect":
                if not input_bytes:
                    raise ValueError("Input PDF is required for encryption.")
                user_pwd = params.get("password") or params.get("user_password")
                if not user_pwd:
                    raise ValueError("A password must be provided to protect this document.")
                owner_pwd = params.get("owner_password")

                db.add(JobEvent(job_id=job.id, message="Applying AES-256 standard encryption.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFSecurity.protect_pdf(input_bytes, user_password=user_pwd, owner_password=owner_pwd)
                out_name = "protected_document.pdf"

            elif tool == "unlock":
                if not input_bytes:
                    raise ValueError("Input PDF is required for decryption.")
                user_pwd = params.get("password") or params.get("user_password")
                if not user_pwd:
                    raise ValueError("A password must be provided to unlock this document.")

                db.add(JobEvent(job_id=job.id, message="Verifying credentials and decrypting PDF.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFSecurity.unlock_pdf(input_bytes, password=user_pwd)
                out_name = "unlocked_document.pdf"

            elif tool == "rotate":
                if not input_bytes:
                    raise ValueError("Input PDF is required for rotation.")
                angle = int(params.get("angle", 90))
                page_numbers = params.get("page_numbers") or params.get("pages")
                db.add(JobEvent(job_id=job.id, message=f"Rotating pages by {angle} degrees.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFProcessor.rotate_pages(input_bytes, angle=angle, page_numbers=page_numbers)
                out_name = "rotated_document.pdf"

            elif tool == "watermark":
                if not input_bytes:
                    raise ValueError("Input PDF is required for watermarking.")
                text = params.get("text") or params.get("watermark_text") or "CONFIDENTIAL"
                opacity = float(params.get("opacity", 0.3))
                font_size = int(params.get("font_size", 48))
                rotation = int(params.get("rotation", 45))
                color_hex = str(params.get("color_hex") or params.get("color") or "#6b7280")
                db.add(JobEvent(job_id=job.id, message=f"Applying watermark overlay.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFSecurity.add_watermark(
                    input_bytes,
                    text=text,
                    opacity=opacity,
                    font_size=font_size,
                    rotation=rotation,
                    color_hex=color_hex
                )
                out_name = "watermarked_document.pdf"

            elif tool in ("page_numbers", "number_pages"):
                if not input_bytes:
                    raise ValueError("Input PDF is required for page numbering.")
                position = params.get("position", "bottom-center")
                start = int(params.get("start_number", 1))
                db.add(JobEvent(job_id=job.id, message="Adding page numbers.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFProcessor.add_page_numbers(input_bytes, position=position, start_number=start)
                out_name = "numbered_document.pdf"

            elif tool in ("pdf_to_jpg", "pdf_to_images"):
                if not input_bytes:
                    raise ValueError("Input PDF is required to render images.")
                db.add(JobEvent(job_id=job.id, message="Rendering PDF pages to images.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                images = PDFConverter.pdf_to_images(input_bytes, dpi=int(params.get("dpi", 150)))
                out_bytes = PDFConverter.create_zip_archive(images)
                out_name = "rendered_images.zip"

            elif tool in ("jpg_to_pdf", "images_to_pdf"):
                if not input_bytes:
                    raise ValueError("Input image is required to build PDF.")
                db.add(JobEvent(job_id=job.id, message="Assembling images into PDF.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFConverter.images_to_pdf([input_bytes])
                out_name = "images_document.pdf"

            elif tool == "inspect_ocr":
                if not input_bytes:
                    raise ValueError("Input PDF is required for OCR analysis.")
                db.add(JobEvent(job_id=job.id, message="Inspecting raster density and OCR layer.", event_type="info"))
                job.progress_percentage = 60
                db.commit()
                ocr_report = PDFOCRService.inspect_document(input_bytes)
                out_bytes = json.dumps(ocr_report, indent=2).encode("utf-8")
                out_name = "ocr_inspection_report.json"

            elif tool == "repair":
                if not input_bytes:
                    raise ValueError("Input PDF is required for reconstruction.")
                db.add(JobEvent(job_id=job.id, message="Reconstructing malformed xref and streams.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                out_bytes = PDFUtilities.repair_pdf(input_bytes)
                out_name = "repaired_document.pdf"

            elif tool == "extract_images":
                if not input_bytes:
                    raise ValueError("Input PDF is required for image extraction.")
                db.add(JobEvent(job_id=job.id, message="Extracting embedded raster images.", event_type="info"))
                job.progress_percentage = 50
                db.commit()
                extracted = PDFUtilities.extract_images(input_bytes)
                out_bytes = PDFConverter.create_zip_archive(extracted)
                out_name = "extracted_images.zip"

            else:
                if not input_bytes:
                    raise ValueError(f"No input file provided for processing tool '{job.tool_name}'.")
                out_bytes = input_bytes
                out_name = f"processed_{tool}.pdf"

            # Validate that output was actually produced
            if not out_bytes:
                raise ValueError("Processing engine returned empty output.")

            # Save result in VaultStorage (automatically persists to Cloudflare R2 and local disk cache)
            rel_path, final_name, size, _ = storage.save_bytes(job.user_id, out_bytes, out_name)
            job.output_storage_path = rel_path
            job.output_file_name = final_name
            job.output_size_bytes = size
            
            job.status = "completed"
            job.progress_percentage = 100
            job.completed_at = datetime.now(timezone.utc)
            db.add(JobEvent(job_id=job.id, message="Job completed successfully.", event_type="milestone"))
            db.commit()
            logger.info(f"Job {job.id} completed successfully (output: {job.output_file_name}, size: {size} bytes).")

            # Prune ephemeral scratchpad file if R2 is configured to preserve memory/disk
            if settings.is_production and settings.r2_configured and job.input_file_name:
                storage.cleanup_local_file(job.input_file_name)

        except Exception as e:
            logger.error(f"Job {job.id} failed: {e}", exc_info=True)
            job.status = "failed"
            job.error_message = str(e)
            job.error_code = "PROCESSING_ERROR"
            db.add(JobEvent(job_id=job.id, message=f"Job failed: {str(e)}", event_type="error"))
            db.commit()
        finally:
            gc.collect()

    def run(self):
        """Main worker execution loop for standalone process."""
        logger.info("BricDoc Standalone PDF Worker initialized and polling for jobs...")
        while RUNNING:
            self.emit_heartbeat()
            db = SessionLocal()
            try:
                job = self.fetch_next_job(db)
                if job:
                    self.execute_job(job, db)
                else:
                    time.sleep(2)
            except Exception as e:
                logger.error(f"Worker iteration error: {e}")
                time.sleep(3)
            finally:
                db.close()
                gc.collect()
        logger.info("Worker process terminated gracefully.")


def _claim_and_execute_sync(worker: PDFWorker, db) -> bool:
    """Helper executed in worker thread to prevent blocking FastAPI event loop."""
    job = worker.fetch_next_job(db)
    if job:
        worker.execute_job(job, db)
        return True
    return False


async def run_inprocess_worker(poll_interval: float = 2.0):
    """
    Asynchronous background coroutine running within the FastAPI application event loop.
    Polls the database-backed queue and executes jobs sequentially (concurrency=1)
    to prevent OOM on 512MB RAM free compute.
    """
    global INPROCESS_WORKER_RUNNING
    INPROCESS_WORKER_RUNNING = True
    worker = PDFWorker()
    logger.info("BricDoc In-Process Background PDF Worker started (concurrency limit: 1).")

    while INPROCESS_WORKER_RUNNING:
        try:
            worker.emit_heartbeat()
            db = SessionLocal()
            try:
                loop = asyncio.get_running_loop()
                executed = await loop.run_in_executor(None, _claim_and_execute_sync, worker, db)
                if executed:
                    gc.collect()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"In-process worker iteration error: {e}")

        await asyncio.sleep(poll_interval)

    logger.info("BricDoc In-Process Background PDF Worker stopped.")


def stop_inprocess_worker():
    """Signals in-process worker to stop."""
    global INPROCESS_WORKER_RUNNING
    INPROCESS_WORKER_RUNNING = False


if __name__ == "__main__":
    worker = PDFWorker()
    worker.run()
