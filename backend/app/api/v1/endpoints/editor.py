import json
import base64
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

@router.post("/info")
async def get_editor_pdf_info(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Inspect PDF metadata, page count, and dimensions for the interactive editor.
    """
    if file:
        pdf_bytes = await file.read()
    elif document_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required.")
        doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        abs_path = storage.get_absolute_path(doc.storage_path)
        with open(abs_path, "rb") as f:
            pdf_bytes = f.read()
    else:
        raise HTTPException(status_code=400, detail="Either file upload or document_id is required.")

    try:
        return PDFEditorService.get_info(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to inspect PDF: {str(e)}")

@router.post("/render-page")
async def render_editor_page(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    page: int = Form(1),
    dpi: int = Form(150),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Render a specific page of a PDF as base64 PNG data URL with dimensions and page count.
    """
    if file:
        pdf_bytes = await file.read()
    elif document_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required.")
        doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        abs_path = storage.get_absolute_path(doc.storage_path)
        with open(abs_path, "rb") as f:
            pdf_bytes = f.read()
    else:
        raise HTTPException(status_code=400, detail="Either file upload or document_id is required.")

    try:
        return PDFEditorService.render_page(pdf_bytes, page_num=page, dpi=dpi)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to render page: {str(e)}")

@router.post("/text-blocks")
async def get_editor_text_blocks(
    file: UploadFile = File(...),
    page: int = Form(1)
):
    """
    Extract all selectable and editable text blocks on a page.
    """
    try:
        pdf_bytes = await file.read()
        blocks = PDFEditorService.get_page_text_blocks(pdf_bytes, page_num=page)
        return {"page": page, "blocks": blocks}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text blocks: {str(e)}")

@router.post("/replace-text")
async def replace_editor_text(
    file: UploadFile = File(...),
    find_text: str = Form(...),
    replace_text: str = Form(...),
    page: Optional[int] = Form(None),
    font_size: Optional[float] = Form(None),
    color: Optional[str] = Form("#000000"),
    match_case: bool = Form(False)
):
    """
    Find and replace text occurrences cleanly across a single page or entire document.
    """
    try:
        pdf_bytes = await file.read()
        out_bytes = PDFEditorService.replace_text(
            pdf_bytes=pdf_bytes,
            find_text=find_text,
            replace_text=replace_text,
            page_num=page if page and page > 0 else None,
            font_size=font_size,
            color=color,
            match_case=match_case
        )
        filename = file.filename or "replaced.pdf"
        return Response(
            content=out_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="replaced_{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to replace text: {str(e)}")

@router.post("/delete-text")
async def delete_editor_text(
    file: UploadFile = File(...),
    text_to_delete: str = Form(...),
    page: Optional[int] = Form(None)
):
    """
    Permanently erase and redact specific text occurrences.
    """
    try:
        pdf_bytes = await file.read()
        out_bytes = PDFEditorService.delete_text(
            pdf_bytes=pdf_bytes,
            text_to_delete=text_to_delete,
            page_num=page if page and page > 0 else None
        )
        filename = file.filename or "deleted.pdf"
        return Response(
            content=out_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="modified_{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to delete text: {str(e)}")

@router.post("/replace-block")
async def replace_editor_block(
    file: UploadFile = File(...),
    page: int = Form(...),
    bbox_json: str = Form(...),
    new_text: str = Form(...),
    font_size: Optional[float] = Form(None),
    color: Optional[str] = Form("#000000")
):
    """
    Replace a specific text block at bbox coordinates [x0, y0, x1, y1] on a page.
    """
    try:
        pdf_bytes = await file.read()
        bbox = json.loads(bbox_json)
        out_bytes = PDFEditorService.replace_block(
            pdf_bytes=pdf_bytes,
            page_num=page,
            bbox=bbox,
            new_text=new_text,
            font_size=font_size,
            color=color
        )
        filename = file.filename or "updated.pdf"
        return Response(
            content=out_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="updated_{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to replace block: {str(e)}")

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
