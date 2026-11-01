from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class WorkflowStepCreate(BaseModel):
    order_index: int
    tool_action: str
    parameters_json: Optional[str] = "{}"

class WorkflowStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_index: int
    tool_action: str
    parameters_json: Optional[str]

class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    steps: List[WorkflowStepCreate]

class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    steps: List[WorkflowStepOut] = []

class WorkflowRunRequest(BaseModel):
    workflow_id: str
    document_ids: List[str]

class WorkflowExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workflow_id: str
    status: str
    current_step_index: int
    output_file_name: Optional[str]
    output_storage_path: Optional[str]
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]

