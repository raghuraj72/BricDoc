import io
import json
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
import pytest
import pypdf
from fastapi import HTTPException

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.storage import storage, VaultStorage
from app.models.user import User
from app.models.job import ProcessingJob, JobEvent
from app.services.job_queue import JobQueue
from app.services.pdf_security import PDFSecurity
from app.worker import PDFWorker, _claim_and_execute_sync


@pytest.fixture
def test_user(db_session):
    """Creates a temporary test user."""
    user = User(
        email=f"test_{uuid.uuid4().hex[:8]}@bricdoc.com",
        hashed_password="fakehash123",
        full_name="Production Test User",
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def db_session():
    """Provides a transactional database session for tests with clean state."""
    db = SessionLocal()
    try:
        # Clean up any leftover jobs from previous runs
        db.query(JobEvent).delete()
        db.query(ProcessingJob).delete()
        db.commit()
        yield db
    finally:
        db.close()


def test_storage_user_isolation_and_path_traversal():
    """Verify that user isolation and path traversal guards are strictly enforced."""
    # Invalid user ID should raise HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        storage._get_user_doc_dir("not-a-valid-uuid")
    assert exc_info.value.status_code == 400

    # Path traversal attack attempt
    with pytest.raises(HTTPException) as exc_info:
        storage.get_absolute_path("../../etc/passwd")
    assert exc_info.value.status_code in (400, 404)


def test_storage_save_and_retrieve_bytes():
    """Test saving file bytes and retrieving them locally."""
    user_id = str(uuid.uuid4())
    test_content = b"%PDF-1.4 sample content for bricdoc storage test"
    rel_path, name, size, file_hash = storage.save_bytes(user_id, test_content, "sample.pdf")

    assert "documents/" in rel_path
    assert user_id in rel_path
    assert size == len(test_content)

    # Retrieve and verify content
    retrieved_bytes = storage.get_file_bytes(rel_path)
    assert retrieved_bytes == test_content

    # Clean up
    deleted = storage.delete_file(rel_path)
    assert deleted is True


def test_storage_cleanup_local_file():
    """Verify ephemeral local cache pruning preserves storage safety."""
    user_id = str(uuid.uuid4())
    rel_path, _, _, _ = storage.save_bytes(user_id, b"%PDF-1.4 test ephemeral prune", "temp.pdf")
    abs_path = storage.base_dir / rel_path
    assert abs_path.is_file()

    # Prune local copy
    pruned = storage.cleanup_local_file(rel_path)
    assert pruned is True
    assert not abs_path.exists()


def test_storage_r2_cache_miss_download():
    """Simulate worker container missing local file and pulling it from R2."""
    mock_s3 = MagicMock()
    mock_content = b"%PDF-1.4 Mocked Cloudflare R2 Remote File Content"

    def fake_download_file(bucket, key, local_path):
        with open(local_path, "wb") as f:
            f.write(mock_content)

    mock_s3.download_file.side_effect = fake_download_file

    with patch.object(storage, "_get_s3_client", return_value=mock_s3):
        with patch.object(settings, "R2_BUCKET_NAME", "bricdoc-test-bucket"):
            user_id = str(uuid.uuid4())
            rel_path = f"documents/{user_id}/remote_only_doc.pdf"

            # File does NOT exist locally yet
            resolved = storage.base_dir / rel_path
            if resolved.exists():
                resolved.unlink()

            # Calling ensure_local_copy should invoke R2 download
            local_path = storage.ensure_local_copy(rel_path)
            assert local_path.is_file()
            assert local_path.read_bytes() == mock_content
            mock_s3.download_file.assert_called_once()

            # Clean up
            storage.delete_file(rel_path)


def test_storage_production_enforcement():
    """In production, R2 upload failure must NOT fall back silently to local disk."""
    original_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "production"
        assert settings.is_production is True

        mock_s3 = MagicMock()
        mock_s3.upload_file.side_effect = RuntimeError("R2 S3 connection timeout")

        with patch.object(storage, "_get_s3_client", return_value=mock_s3):
            with patch.object(settings, "R2_BUCKET_NAME", "bricdoc-test-bucket"):
                user_id = str(uuid.uuid4())
                with pytest.raises(HTTPException) as exc_info:
                    storage.save_bytes(user_id, b"some content", "test.pdf")
                assert exc_info.value.status_code == 500
    finally:
        settings.ENVIRONMENT = original_env


def test_job_queue_and_worker_protect_unlock(db_session, test_user, sample_pdf_bytes):
    """Verify background worker protects PDF with user password and unlocks it."""
    # Save sample PDF into storage
    rel_path, _, _, _ = storage.save_bytes(test_user.id, sample_pdf_bytes, "input.pdf")

    custom_password = "MyCustomUltraSecurePass2026!"

    # 1. Enqueue Protect Job
    job = JobQueue.enqueue_job(
        db=db_session,
        user_id=test_user.id,
        tool_name="protect",
        input_file_name=rel_path,
        parameters={"password": custom_password}
    )
    assert job.status == "queued"
    assert job.parsed_parameters.get("password") == custom_password

    # 2. Worker claims and executes Protect Job
    worker = PDFWorker()
    claimed_job = worker.fetch_next_job(db_session)
    assert claimed_job is not None
    assert claimed_job.id == job.id

    worker.execute_job(claimed_job, db_session)
    db_session.refresh(claimed_job)

    assert claimed_job.status == "completed"
    assert claimed_job.output_storage_path is not None

    # Verify encrypted output
    protected_bytes = storage.get_file_bytes(claimed_job.output_storage_path)
    reader = pypdf.PdfReader(io.BytesIO(protected_bytes))
    assert reader.is_encrypted

    # 3. Enqueue Unlock Job with encrypted PDF
    unlock_job = JobQueue.enqueue_job(
        db=db_session,
        user_id=test_user.id,
        tool_name="unlock",
        input_file_name=claimed_job.output_storage_path,
        parameters={"password": custom_password}
    )
    claimed_unlock = worker.fetch_next_job(db_session)
    assert claimed_unlock is not None
    assert claimed_unlock.id == unlock_job.id

    worker.execute_job(claimed_unlock, db_session)
    db_session.refresh(claimed_unlock)

    assert claimed_unlock.status == "completed"
    unlocked_bytes = storage.get_file_bytes(claimed_unlock.output_storage_path)
    unlocked_reader = pypdf.PdfReader(io.BytesIO(unlocked_bytes))
    assert not unlocked_reader.is_encrypted
    assert len(unlocked_reader.pages) == 2

    # Clean up
    storage.delete_file(rel_path)
    storage.delete_file(claimed_job.output_storage_path)
    storage.delete_file(claimed_unlock.output_storage_path)


def test_inprocess_worker_execution(db_session, test_user, sample_pdf_bytes):
    """Verify in-process worker helper processes a queued job cleanly from database without Redis."""
    rel_path, _, _, _ = storage.save_bytes(test_user.id, sample_pdf_bytes, "doc.pdf")

    job = JobQueue.enqueue_job(
        db=db_session,
        user_id=test_user.id,
        tool_name="compress",
        input_file_name=rel_path,
        parameters={"level": "recommended"}
    )
    assert job.status == "queued"

    worker = PDFWorker()
    executed = _claim_and_execute_sync(worker, db_session)
    assert executed is True

    db_session.refresh(job)
    assert job.status == "completed"
    assert job.output_storage_path is not None
    storage.delete_file(rel_path)
    storage.delete_file(job.output_storage_path)


def test_worker_fails_on_missing_input_file(db_session, test_user):
    """Verify background worker fails explicitly when input file does not exist, without fake PDF."""
    job = JobQueue.enqueue_job(
        db=db_session,
        user_id=test_user.id,
        tool_name="compress",
        input_file_name="documents/non_existent_file.pdf"
    )
    worker = PDFWorker()
    claimed_job = worker.fetch_next_job(db_session)
    assert claimed_job is not None

    worker.execute_job(claimed_job, db_session)
    db_session.refresh(claimed_job)

    assert claimed_job.status == "failed"
    assert claimed_job.error_code == "PROCESSING_ERROR"
    assert "could not be retrieved" in claimed_job.error_message


def test_worker_recovers_stalled_jobs(db_session, test_user):
    """Verify that jobs stuck in 'processing' are recovered."""
    stalled_job = ProcessingJob(
        user_id=test_user.id,
        tool_name="split",
        status="processing",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=15),
        retry_count=1
    )
    db_session.add(stalled_job)
    db_session.commit()
    db_session.refresh(stalled_job)

    worker = PDFWorker()
    worker.recover_stalled_jobs(db_session)
    db_session.refresh(stalled_job)

    assert stalled_job.status == "queued"
