from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class JobEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    message: str
    event_type: str
    timestamp: datetime

class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tool_name: str
    status: str
    progress_percentage: int
    input_file_name: Optional[str]
    output_file_name: Optional[str]
    output_size_bytes: Optional[int]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    events: List[JobEventOut] = []

