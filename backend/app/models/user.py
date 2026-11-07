import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="owner", cascade="all, delete-orphan")
    jobs = relationship("ProcessingJob", back_populates="user", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="user", cascade="all, delete-orphan")
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    payment_methods = relationship("PaymentMethod", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    avatar_url = Column(String(512), nullable=True)
    job_title = Column(String(128), nullable=True)
    organization = Column(String(128), nullable=True)
    preferred_theme = Column(String(16), default="system")  # light, dark, system
    language = Column(String(8), default="en")
    storage_used_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="profile")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    plan_tier = Column(String(32), default="free")  # "free", "pro", "business"
    status = Column(String(32), default="active")   # "active", "cancelled", "past_due", "expired"
    max_storage_bytes = Column(Integer, default=500 * 1024 * 1024)  # 500 MB for Free tier
    max_file_size_mb = Column(Integer, default=25)
    ai_credits_monthly = Column(Integer, default=50)
    ai_credits_used = Column(Integer, default=0)
    first_time_offer_used = Column(Boolean, default=False)
    auto_renew_enabled = Column(Boolean, default=True)
    payment_method_id = Column(String(36), nullable=True)
    razorpay_subscription_id = Column(String(128), nullable=True, index=True)
    razorpay_customer_id = Column(String(128), nullable=True)
    current_period_start = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="subscription")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_type = Column(String(32), nullable=False)  # "card" or "upi"
    card_brand = Column(String(32), nullable=True)     # "visa", "mastercard", "rupay", "amex"
    card_last4 = Column(String(4), nullable=True)      # "4242"
    card_exp_month = Column(String(2), nullable=True)  # "12"
    card_exp_year = Column(String(4), nullable=True)   # "2028"
    cardholder_name = Column(String(128), nullable=True)
    upi_vpa = Column(String(128), nullable=True)       # "alex@okhdfcbank"
    mandate_status = Column(String(32), default="active")  # "active", "cancelled", "paused"
    mandate_frequency = Column(String(32), default="monthly")
    mandate_amount = Column(Integer, default=12)       # $12/month
    auto_renew_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="payment_methods")


class DailyUsage(Base):
    __tablename__ = "daily_usages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    identifier = Column(String(128), index=True, nullable=False)  # "user:<id>" or "ip:<ip_addr>"
    usage_date = Column(String(10), index=True, nullable=False)   # "YYYY-MM-DD" in UTC
    files_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# Re-export payment models for backwards-compatibility
from app.models.payment import (
    PaymentOrder,
    PaymentAttempt,
    PaymentTransaction,
    Invoice,
    Refund,
    WebhookEvent,
    SubscriptionEvent
)
