import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import storage
from app.api.v1.endpoints.auth import get_current_user_optional, get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.ai import AIConversation, AIMessage, AIDocumentSource
from app.schemas.ai import (
    AISummaryRequest,
    AIChatRequest,
    AIExtractRequest,
    AIStudyRequest,
    AIConversationOut,
    AIMessageOut
)
from app.services.ai_service import ai_service

router = APIRouter()

def _get_pdf_bytes_for_ai(
    file: Optional[UploadFile],
    document_id: Optional[str],
    current_user: Optional[User],
    db: Session
) -> bytes:
    if file:
        return file.file.read()
    elif document_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required to access saved documents.")
        doc = db.query(Document).filter(
            Document.id == document_id,
            Document.owner_id == current_user.id
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        abs_path = storage.get_absolute_path(doc.storage_path)
        with open(abs_path, "rb") as f:
            return f.read()
    else:
        raise HTTPException(status_code=400, detail="Either a file upload or document_id is required.")

@router.post("/summarize")
async def summarize_document(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    summary_type: str = Form("structured"),
    max_length: str = Form("medium"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Generate grounded structured summary with source page references."""
    pdf_bytes = _get_pdf_bytes_for_ai(file, document_id, current_user, db)
    return ai_service.summarize(pdf_bytes, summary_type=summary_type, max_length=max_length)

@router.post("/chat")
async def chat_with_pdf(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    conversation_id: Optional[str] = Form(None),
    message: str = Form(...),
    selected_pages: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Grounded question-answering with PDF content, page citations,
    and persistent conversation history when authenticated.
    """
    pdf_bytes = _get_pdf_bytes_for_ai(file, document_id, current_user, db)
    pages_list = None
    if selected_pages:
        try:
            pages_list = [int(p.strip()) for p in selected_pages.split(",") if p.strip()]
        except ValueError:
            pass

    # Call AI service
    result = ai_service.chat_with_document(
        pdf_bytes=pdf_bytes,
        query=message,
        selected_pages=pages_list
    )

    # If user is authenticated, persist conversation & message
    if current_user:
        convo = None
        if conversation_id:
            convo = db.query(AIConversation).filter(
                AIConversation.id == conversation_id,
                AIConversation.user_id == current_user.id
            ).first()
        if not convo:
            convo = AIConversation(
                user_id=current_user.id,
                title=f"Chat: {message[:40]}"
            )
            db.add(convo)
            db.flush()

        # Save user message
        db.add(AIMessage(
            conversation_id=convo.id,
            role="user",
            content=message
        ))
        # Save assistant message
        db.add(AIMessage(
            conversation_id=convo.id,
            role="assistant",
            content=result.get("answer", ""),
            citations_json=json.dumps(result.get("citations", []))
        ))
        db.commit()
        result["conversation_id"] = convo.id

    return result

@router.post("/extract")
async def extract_document_insights(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    extract_type: str = Form("key_points"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Extract action items, key points, or named entities from document."""
    pdf_bytes = _get_pdf_bytes_for_ai(file, document_id, current_user, db)
    return ai_service.extract_key_points(pdf_bytes, extract_type=extract_type)

@router.post("/study")
async def generate_study_assistant(
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    output_type: str = Form("flashcards"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Generate study flashcards or quiz items grounded in document text."""
    pdf_bytes = _get_pdf_bytes_for_ai(file, document_id, current_user, db)
    return ai_service.study_assistant(pdf_bytes, output_type=output_type)

@router.get("/conversations", response_model=List[AIConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List authenticated user's AI conversations."""
    return db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).order_by(AIConversation.updated_at.desc()).all()
