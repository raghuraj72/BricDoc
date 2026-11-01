import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(64), nullable=False, index=True)  # LOGIN, UPLOAD, DELETE, PROCESS, SHARE, EXPORT
    resource_type = Column(String(64), nullable=True)        # document, user, workflow, share
    resource_id = Column(String(64), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(128), nullable=False)
    message = Column(String(512), nullable=False)
    notification_type = Column(String(32), default="info")  # info, success, warning, error
    is_read = Column(Boolean, default=False)
    action_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="notifications")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    metric_name = Column(String(64), nullable=False, index=True)  # bytes_processed, ai_tokens, pages_converted
    quantity = Column(Integer, default=1)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
