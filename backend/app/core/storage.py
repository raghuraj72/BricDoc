import hashlib
import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO, Generator, Optional, Tuple
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

class VaultStorage:
    """
    Secure file vault storage provider.
    Enforces user isolation, prevents path traversal, and manages binary storage.
    """
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.STORAGE_DIR).resolve()
        self.documents_dir = self.base_dir / "documents"
        self.temp_dir = self.base_dir / "temp"
        self.thumbnails_dir = self.base_dir / "thumbnails"
        
        self.documents_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.thumbnails_dir.mkdir(parents=True, exist_ok=True)

    def _get_user_doc_dir(self, user_id: str) -> Path:
        """Get or create isolated storage folder for a user."""
        safe_user_id = str(uuid.UUID(str(user_id)))  # Validates UUID format
        user_dir = self.documents_dir / safe_user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to avoid injection and path traversal."""
        clean_name = os.path.basename(filename).replace("..", "").replace("/", "").replace("\\", "")
        return clean_name or "unnamed_document"

    def compute_sha256(self, file_path: Path) -> str:
        """Compute SHA256 checksum of file for integrity and duplicate detection."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        return hasher.hexdigest()

    def save_upload(self, user_id: str, file: UploadFile) -> Tuple[str, str, int, str]:
        """
        Saves an uploaded file to user's private vault.
        Returns (storage_path, original_filename, file_size_bytes, sha256_hash).
        """
        user_dir = self._get_user_doc_dir(user_id)
        sanitized_original = self.sanitize_filename(file.filename or "upload.pdf")
        extension = Path(sanitized_original).suffix.lower()
        if not extension:
            extension = ".pdf"
            
        storage_filename = f"{uuid.uuid4().hex}{extension}"
        target_path = user_dir / storage_filename
        
        total_size = 0
        hasher = hashlib.sha256()
        
        with open(target_path, "wb") as buffer:
            while chunk := file.file.read(1024 * 64):
                total_size += len(chunk)
                if total_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                    # Clean up partial file
                    buffer.close()
                    if target_path.exists():
                        target_path.unlink()
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
                    )
                hasher.update(chunk)
                buffer.write(chunk)
                
        # Return relative storage key, original name, size, sha256
        rel_storage_path = f"documents/{user_id}/{storage_filename}"
        return rel_storage_path, sanitized_original, total_size, hasher.hexdigest()

    def save_bytes(self, user_id: str, data: bytes, filename: str) -> Tuple[str, str, int, str]:
        """Saves generated binary data (e.g. processed PDF) into user's private storage."""
        user_dir = self._get_user_doc_dir(user_id)
        sanitized_original = self.sanitize_filename(filename)
        extension = Path(sanitized_original).suffix.lower() or ".pdf"
        
        storage_filename = f"{uuid.uuid4().hex}{extension}"
        target_path = user_dir / storage_filename
        
        with open(target_path, "wb") as f:
            f.write(data)
            
        file_size = len(data)
        file_hash = hashlib.sha256(data).hexdigest()
        rel_storage_path = f"documents/{user_id}/{storage_filename}"
        return rel_storage_path, sanitized_original, file_size, file_hash

    def get_absolute_path(self, storage_path: str) -> Path:
        """Resolve a relative storage key to an absolute validated path."""
        # Prevent path traversal
        clean_path = Path(storage_path)
        resolved = (self.base_dir / clean_path).resolve()
        if not str(resolved).startswith(str(self.base_dir)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path."
            )
        if not resolved.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found in storage."
            )
        return resolved

    def delete_file(self, storage_path: str) -> bool:
        """Safely delete file from storage."""
        try:
            abs_path = self.get_absolute_path(storage_path)
            if abs_path.is_file():
                abs_path.unlink()
                return True
        except Exception:
            pass
        return False

storage = VaultStorage()
