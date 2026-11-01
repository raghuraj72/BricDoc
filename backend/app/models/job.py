import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_name = Column(String(64), nullable=False, index=True)
    status = Column(String(32), default="queued", index=True)  # queued, processing, completed, failed, cancelled
    progress_percentage = Column(Integer, default=0)
    
    input_file_name = Column(String(255), nullable=True)
    output_storage_path = Column(String(512), nullable=True)
    output_file_name = Column(String(255), nullable=True)
    output_size_bytes = Column(Integer, nullable=True)
    
    error_message = Column(Text, nullable=True)
    error_code = Column(String(64), nullable=True)
    retry_count = Column(Integer, default=0)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="jobs")
    events = relationship("JobEvent", back_populates="job", cascade="all, delete-orphan")


class JobEvent(Base):
    __tablename__ = "job_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(String(255), nullable=False)
    event_type = Column(String(32), default="info")  # info, warning, error, milestone
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    job = relationship("ProcessingJob", back_populates="events")
