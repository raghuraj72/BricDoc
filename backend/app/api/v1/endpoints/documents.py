import io
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import pymupdf

from app.core.database import get_db
from app.core.storage import storage
from app.api.v1.endpoints.auth import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.document import Document, Folder, DocumentTag, DocumentShare
from app.schemas.document import (
    DocumentOut,
    DocumentUpdate,
    FolderCreate,
    FolderOut,
    ShareCreate,
    ShareOut
)

router = APIRouter()

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a document to the user's private vault."""
    if folder_id:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.owner_id == current_user.id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Target folder not found.")

    storage_path, original_name, file_size, sha256_hash = storage.save_upload(current_user.id, file)

    # Determine page count and preview if PDF
    page_count = 1
    extracted_preview = ""
    try:
        abs_path = storage.get_absolute_path(storage_path)
        with open(abs_path, "rb") as f:
            pdf_bytes = f.read()
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        if page_count > 0:
            extracted_preview = doc[0].get_text()[:400]
        doc.close()
    except Exception:
        pass

    doc_record = Document(
        owner_id=current_user.id,
        folder_id=folder_id,
        filename=original_name,
        storage_path=storage_path,
        file_type=original_name.split(".")[-1].lower() if "." in original_name else "pdf",
        mime_type=file.content_type or "application/pdf",
        file_size_bytes=file_size,
        sha256_hash=sha256_hash,
        page_count=page_count,
        extracted_text_preview=extracted_preview
    )
    db.add(doc_record)

    # Update profile storage used
    if current_user.profile:
        current_user.profile.storage_used_bytes += file_size

    db.commit()
    db.refresh(doc_record)
    return doc_record

@router.get("", response_model=List[DocumentOut])
def list_documents(
    folder_id: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    is_trashed: bool = Query(False),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List documents owned by current user with optional filters."""
    query = db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.is_trashed == is_trashed
    )
    if folder_id is not None:
        query = query.filter(Document.folder_id == folder_id)
    if is_favorite is not None:
        query = query.filter(Document.is_favorite == is_favorite)
    if search:
        query = query.filter(Document.filename.ilike(f"%{search}%"))

    return query.order_by(Document.created_at.desc()).all()



# ----------------- FOLDERS -----------------

@router.post("/folders", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_in: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new folder for document organization."""
    folder = Folder(
        owner_id=current_user.id,
        name=folder_in.name.strip(),
        parent_id=folder_in.parent_id,
        color=folder_in.color or "#4f46e5"
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder

@router.get("/folders", response_model=List[FolderOut])
def list_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all folders owned by user."""
    return db.query(Folder).filter(Folder.owner_id == current_user.id).all()

# ----------------- SHARING -----------------

@router.post("/share", response_model=ShareOut)
def create_share_link(
    share_in: ShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a time-bounded public share link for a document."""
    doc = db.query(Document).filter(
        Document.id == share_in.document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    token = secrets.token_urlsafe(32)
    expires_at = None
    if share_in.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=share_in.expires_in_hours)

    share = DocumentShare(
        document_id=doc.id,
        share_token=token,
        expires_at=expires_at,
        allow_download=share_in.allow_download
    )
    db.add(share)
    db.commit()

    return ShareOut(
        share_token=token,
        share_url=f"/shared/{token}",
        expires_at=expires_at,
        allow_download=share_in.allow_download,
        created_at=share.created_at
    )

@router.get("/shared/{token}")
def get_shared_document(token: str, db: Session = Depends(get_db)):
    """Access shared document metadata via share token."""
    share = db.query(DocumentShare).filter(
        DocumentShare.share_token == token,
        DocumentShare.is_active == True
    ).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or inactive.")

    if share.expires_at:
        exp = share.expires_at.replace(tzinfo=timezone.utc) if share.expires_at.tzinfo is None else share.expires_at
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="This share link has expired.")

    share.view_count += 1
    db.commit()

    doc = share.document
    return {
        "filename": doc.filename,
        "file_size_bytes": doc.file_size_bytes,
        "page_count": doc.page_count,
        "allow_download": share.allow_download,
        "download_url": f"/api/v1/documents/shared/{token}/download" if share.allow_download else None
    }

@router.get("/shared/{token}/download")
def download_shared_document(token: str, db: Session = Depends(get_db)):
    """Download document via valid share token."""
    share = db.query(DocumentShare).filter(
        DocumentShare.share_token == token,
        DocumentShare.is_active == True
    ).first()
    if not share or not share.allow_download:
        raise HTTPException(status_code=404, detail="Download not permitted or share expired.")

    if share.expires_at:
        exp = share.expires_at.replace(tzinfo=timezone.utc) if share.expires_at.tzinfo is None else share.expires_at
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Share link expired.")

    doc = share.document
    abs_path = storage.get_absolute_path(doc.storage_path)
    return FileResponse(
        path=str(abs_path),
        filename=doc.filename,
        media_type=doc.mime_type
    )

# ----------------- DOCUMENT BY ID -----------------

@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve document metadata by ID."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc

@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: str,
    update_in: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update document properties (name, favorite, folder)."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if update_in.filename is not None:
        doc.filename = storage.sanitize_filename(update_in.filename)
    if update_in.folder_id is not None:
        doc.folder_id = update_in.folder_id
    if update_in.is_favorite is not None:
        doc.is_favorite = update_in.is_favorite

    db.commit()
    db.refresh(doc)
    return doc

@router.post("/{document_id}/trash")
def trash_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move document to trash."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc.is_trashed = True
    doc.trashed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Document moved to trash."}

@router.post("/{document_id}/restore")
def restore_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore document from trash."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc.is_trashed = False
    doc.trashed_at = None
    db.commit()
    return {"message": "Document restored from trash."}

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_permanently(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete document and remove underlying file from storage."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    storage.delete_file(doc.storage_path)
    if current_user.profile and current_user.profile.storage_used_bytes >= doc.file_size_bytes:
        current_user.profile.storage_used_bytes -= doc.file_size_bytes

    db.delete(doc)
    db.commit()
    return None

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Authorized download of a private document."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    abs_path = storage.get_absolute_path(doc.storage_path)
    return FileResponse(
        path=str(abs_path),
        filename=doc.filename,
        media_type=doc.mime_type
    )

@router.get("/{document_id}/preview")
def preview_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stream PDF document inline for in-browser viewer."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    abs_path = storage.get_absolute_path(doc.storage_path)
    return FileResponse(
        path=str(abs_path),
        filename=doc.filename,
        media_type=doc.mime_type,
        content_disposition_type="inline"
    )


