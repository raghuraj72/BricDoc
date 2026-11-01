import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import storage
from app.api.v1.endpoints.auth import get_current_user_optional, get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.pdf_editor import PDFEditorService

router = APIRouter()

@router.post("/save-edits")
async def save_editor_changes(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    edits_json: str = Form(...),
    save_to_vault: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Apply visual edits, text boxes, freehand annotations, and highlights to a PDF.
    Returns the modified PDF or saves it to the user's vault.
    """
    if file:
        pdf_bytes = await file.read()
        filename = file.filename or "edited.pdf"
    elif document_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required to edit saved document.")
        doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        abs_path = storage.get_absolute_path(doc.storage_path)
        with open(abs_path, "rb") as f:
            pdf_bytes = f.read()
        filename = doc.filename
    else:
        raise HTTPException(status_code=400, detail="Either file upload or document_id is required.")

    try:
        edits = json.loads(edits_json)
        edited_bytes = PDFEditorService.apply_edits(pdf_bytes, edits)

        if save_to_vault and current_user:
            storage_path, name, size, sha = storage.save_bytes(
                user_id=current_user.id,
                data=edited_bytes,
                filename=f"edited_{filename}"
            )
            new_doc = Document(
                owner_id=current_user.id,
                filename=name,
                storage_path=storage_path,
                file_type="pdf",
                mime_type="application/pdf",
                file_size_bytes=size,
                sha256_hash=sha,
                page_count=1
            )
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)
            return {"message": "Document saved to vault.", "document_id": new_doc.id}

        return Response(
            content=edited_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="edited_{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Editor save error: {str(e)}")
