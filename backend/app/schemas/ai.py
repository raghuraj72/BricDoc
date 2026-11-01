from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class AISummaryRequest(BaseModel):
    document_id: Optional[str] = None
    summary_type: str = Field("structured", description="structured, executive, key_points, bullet_points")
    max_length: Optional[str] = "medium"  # short, medium, long

class AIChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    document_ids: List[str] = Field(default_factory=list)
    message: str
    page_selection: Optional[List[int]] = None

class AIExtractRequest(BaseModel):
    document_id: str
    target_schema: Optional[str] = None  # description or fields to extract
    extract_type: str = Field("key_points", description="key_points, action_items, entities, tables")

class AITranslateRequest(BaseModel):
    document_id: str
    target_language: str = "es"

class AIStudyRequest(BaseModel):
    document_id: str
    output_type: str = Field("flashcards", description="flashcards, practice_quiz, study_notes")

class AICitation(BaseModel):
    document_name: str
    page_number: int
    snippet: str

class AIMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: str
    content: str
    citations: Optional[List[AICitation]] = None
    created_at: datetime

class AIConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[AIMessageOut] = []

