import hashlib
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO, Generator, Optional, Tuple
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger("bricdoc.storage")


class VaultStorage:
    """
    Production File Vault Storage Provider.
    Enforces user isolation, prevents path traversal attacks, manages local disk caching,
    and synchronizes authoritatively with Cloudflare R2 / S3 object storage.
    """

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        self.documents_dir = self.base_dir / "documents"
        self.temp_dir = self.base_dir / "temp"
        self.thumbnails_dir = self.base_dir / "thumbnails"
        self.invoices_dir = self.base_dir / "invoices"

        self.documents_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.thumbnails_dir.mkdir(parents=True, exist_ok=True)
        self.invoices_dir.mkdir(parents=True, exist_ok=True)
        self._s3_client = None

    def _get_user_doc_dir(self, user_id: str) -> Tuple[Path, str]:
        """Get or create isolated storage folder for a user. Validates UUID format."""
        try:
            safe_user_id = str(uuid.UUID(str(user_id)))
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user identification format."
            )
        user_dir = self.documents_dir / safe_user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir, safe_user_id

    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to avoid injection, path traversal, and illegal chars."""
        clean_name = os.path.basename(filename).replace("..", "").replace("/", "").replace("\\", "").replace("\x00", "")
        clean_name = clean_name.strip()
        if not clean_name:
            clean_name = "document.pdf"
        # Enforce maximum length
        if len(clean_name) > 200:
            ext = Path(clean_name).suffix
            clean_name = clean_name[:190] + ext
        return clean_name

    def compute_sha256(self, file_path: Path) -> str:
        """Compute SHA256 checksum of file for integrity and duplicate detection."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _get_s3_client(self):
        """Initializes and returns cached S3 client for Cloudflare R2."""
        if not settings.r2_configured:
            return None
        if self._s3_client is not None:
            return self._s3_client

        try:
            import boto3
            from botocore.config import Config
            endpoint = settings.get_r2_endpoint()
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(
                    signature_version="s3v4",
                    connect_timeout=5,
                    read_timeout=15,
                    retries={"max_attempts": 3, "mode": "standard"}
                )
            )
            return self._s3_client
        except Exception as e:
            logger.error(f"Failed to initialize Cloudflare R2 client: {e}")
            return None

    def _upload_to_object_storage(self, local_path: Path, storage_key: str) -> bool:
        """
        Uploads local file to Cloudflare R2 bucket.
        In production, failure to upload raises an error.
        """
        s3 = self._get_s3_client()
        if not s3:
            if settings.is_production:
                logger.error("Production storage failure: Cloudflare R2 is required in production but not configured.")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Cloud object storage service is unavailable. R2 configuration is required in production."
                )
            return False

        try:
            s3.upload_file(str(local_path), settings.R2_BUCKET_NAME, storage_key)
            logger.info(f"Successfully synced file to R2: {storage_key}")
            return True
        except Exception as e:
            logger.error(f"Failed to upload {storage_key} to Cloudflare R2: {e}")
            if settings.is_production:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to persist file to cloud object storage: {str(e)}"
                )
            return False

    def save_upload(self, user_id: str, file: UploadFile) -> Tuple[str, str, int, str]:
        """
        Saves an uploaded file to user's private vault and syncs to Cloudflare R2.
        Returns (storage_path, original_filename, file_size_bytes, sha256_hash).
        """
        user_dir, safe_user_id = self._get_user_doc_dir(user_id)
        sanitized_original = self.sanitize_filename(file.filename or "upload.pdf")
        extension = Path(sanitized_original).suffix.lower()
        if not extension:
            extension = ".pdf"

        storage_filename = f"{uuid.uuid4().hex}{extension}"
        target_path = user_dir / storage_filename

        total_size = 0
        hasher = hashlib.sha256()

        try:
            with open(target_path, "wb") as buffer:
                while chunk := file.file.read(1024 * 64):
                    total_size += len(chunk)
                    if total_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                        buffer.close()
                        if target_path.exists():
                            target_path.unlink()
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
                        )
                    hasher.update(chunk)
                    buffer.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            if target_path.exists():
                target_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error saving upload: {str(e)}"
            )

        rel_storage_path = f"documents/{safe_user_id}/{storage_filename}"

        # Upload to Cloudflare R2 / S3
        try:
            self._upload_to_object_storage(target_path, rel_storage_path)
        except Exception:
            # If upload fails in production, remove local orphan file
            if target_path.exists():
                target_path.unlink()
            raise

        return rel_storage_path, sanitized_original, total_size, hasher.hexdigest()

    def save_bytes(self, user_id: str, data: bytes, filename: str) -> Tuple[str, str, int, str]:
        """
        Saves generated binary data (e.g. processed PDF) into user's private storage
        and persists to Cloudflare R2.
        """
        user_dir, safe_user_id = self._get_user_doc_dir(user_id)
        sanitized_original = self.sanitize_filename(filename)
        extension = Path(sanitized_original).suffix.lower() or ".pdf"

        storage_filename = f"{uuid.uuid4().hex}{extension}"
        target_path = user_dir / storage_filename

        with open(target_path, "wb") as f:
            f.write(data)

        file_size = len(data)
        file_hash = hashlib.sha256(data).hexdigest()
        rel_storage_path = f"documents/{safe_user_id}/{storage_filename}"

        try:
            self._upload_to_object_storage(target_path, rel_storage_path)
        except Exception:
            if target_path.exists():
                target_path.unlink()
            raise

        return rel_storage_path, sanitized_original, file_size, file_hash

    def ensure_local_copy(self, storage_path: str) -> Path:
        """
        Ensures a local file exists for the given storage path.
        If missing locally (e.g. worker running in a separate container from API),
        transparently downloads the file from Cloudflare R2 into the local cache.
        """
        clean_path = Path(storage_path)
        resolved = (self.base_dir / clean_path).resolve()

        # Strict security guard against path traversal attacks
        if not str(resolved).startswith(str(self.base_dir)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Invalid storage path traversal."
            )

        # Cache Hit: File exists locally and is non-empty
        if resolved.is_file() and resolved.stat().st_size > 0:
            return resolved

        # Cache Miss: Attempt to retrieve from Cloudflare R2
        s3 = self._get_s3_client()
        if s3 and settings.R2_BUCKET_NAME:
            try:
                resolved.parent.mkdir(parents=True, exist_ok=True)
                temp_download = resolved.with_suffix(f"{resolved.suffix}.part_{uuid.uuid4().hex[:8]}")
                logger.info(f"Downloading cache-miss file from R2: {storage_path} -> {resolved}")
                s3.download_file(settings.R2_BUCKET_NAME, storage_path, str(temp_download))
                if temp_download.exists() and temp_download.stat().st_size > 0:
                    temp_download.replace(resolved)
                    return resolved
            except Exception as e:
                logger.warning(f"Could not retrieve {storage_path} from R2: {e}")
                if temp_download.exists():
                    temp_download.unlink()

        # If file is not present locally and cannot be retrieved from R2
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested document could not be found in storage."
        )

    def get_absolute_path(self, storage_path: str) -> Path:
        """Resolve a relative storage key to an absolute validated local path (ensuring R2 sync)."""
        return self.ensure_local_copy(storage_path)

    def get_file_bytes(self, storage_path: str) -> bytes:
        """Convenience method to retrieve file bytes directly."""
        abs_path = self.ensure_local_copy(storage_path)
        with open(abs_path, "rb") as f:
            return f.read()

    def generate_signed_download_url(self, storage_key: str, expires_in_seconds: int = 3600) -> Optional[str]:
        """Generates a secure presigned download URL for R2 / S3 object storage."""
        s3 = self._get_s3_client()
        if not s3 or not settings.R2_BUCKET_NAME:
            return None
        try:
            return s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.R2_BUCKET_NAME, "Key": storage_key},
                ExpiresIn=expires_in_seconds
            )
        except Exception as e:
            logger.warning(f"Failed to generate presigned URL: {e}")
            return None

    def delete_file(self, storage_path: str) -> bool:
        """Safely delete file from both Cloudflare R2 and local disk cache."""
        deleted = False

        # Delete from Cloudflare R2 / S3
        s3 = self._get_s3_client()
        if s3 and settings.R2_BUCKET_NAME:
            try:
                s3.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=storage_path)
                deleted = True
                logger.info(f"Deleted {storage_path} from Cloudflare R2.")
            except Exception as e:
                logger.warning(f"Failed to delete {storage_path} from R2: {e}")

        # Delete from local disk cache
        try:
            clean_path = Path(storage_path)
            resolved = (self.base_dir / clean_path).resolve()
            if str(resolved).startswith(str(self.base_dir)) and resolved.is_file():
                resolved.unlink()
                deleted = True
                logger.info(f"Deleted {storage_path} from local disk cache.")
        except Exception as e:
            logger.warning(f"Failed to delete local cache for {storage_path}: {e}")

        return deleted

    def check_health(self) -> dict:
        """Checks local disk writeability and Cloudflare R2 connectivity."""
        status_info = {
            "local_storage": "healthy",
            "r2_configured": settings.r2_configured,
            "r2_connection": "disabled"
        }
        # Verify local disk write
        try:
            test_file = self.temp_dir / f".health_check_{uuid.uuid4().hex[:8]}"
            test_file.write_text("health_ok")
            test_file.unlink()
        except Exception as e:
            status_info["local_storage"] = f"error: {str(e)}"

        # Verify R2 connection if configured
        if settings.r2_configured:
            s3 = self._get_s3_client()
            if s3:
                try:
                    s3.head_bucket(Bucket=settings.R2_BUCKET_NAME)
                    status_info["r2_connection"] = "connected"
                except Exception as e:
                    status_info["r2_connection"] = f"error: {str(e)}"
            else:
                status_info["r2_connection"] = "client_init_failed"

        return status_info


storage = VaultStorage()
