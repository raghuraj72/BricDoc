import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="workflows")
    steps = relationship("WorkflowStep", back_populates="workflow", order_by="WorkflowStep.order_index", cascade="all, delete-orphan")
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workflow_id = Column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, nullable=False, default=0)
    tool_action = Column(String(64), nullable=False)  # merge, compress, watermark, number, protect, etc.
    parameters_json = Column(Text, nullable=True)  # JSON-encoded parameters

    workflow = relationship("Workflow", back_populates="steps")


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workflow_id = Column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), default="running")  # running, completed, failed
    current_step_index = Column(Integer, default=0)
    input_file_names = Column(Text, nullable=True)
    output_storage_path = Column(String(512), nullable=True)
    output_file_name = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    workflow = relationship("Workflow", back_populates="executions")
