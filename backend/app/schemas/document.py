from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tag_name: str
    color: str

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    color: Optional[str] = "#4f46e5"

class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    parent_id: Optional[str] = None
    color: str
    created_at: datetime

class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    filename: str
    file_type: str
    mime_type: str
    file_size_bytes: int
    page_count: int
    is_favorite: bool
    is_trashed: bool
    folder_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tags: List[TagOut] = []

class DocumentUpdate(BaseModel):
    filename: Optional[str] = None
    folder_id: Optional[str] = None
    is_favorite: Optional[bool] = None

class ShareCreate(BaseModel):
    document_id: str
    expires_in_hours: Optional[int] = 48
    allow_download: bool = True

class ShareOut(BaseModel):
    share_token: str
    share_url: str
    expires_at: Optional[datetime] = None
    allow_download: bool
    created_at: datetime

