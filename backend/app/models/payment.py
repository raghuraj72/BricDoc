import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    gateway = Column(String(32), default="razorpay")  # "razorpay"
    gateway_order_id = Column(String(128), unique=True, index=True, nullable=False)
    amount = Column(Integer, nullable=False)  # in paise
    currency = Column(String(8), default="INR")
    plan_tier = Column(String(32), default="pro")  # "pro" or "business"
    status = Column(String(32), default="created")  # "created", "attempted", "paid", "failed", "cancelled"
    receipt = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    billing_name = Column(String(255), nullable=True)
    billing_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="payment_orders")
    attempts = relationship("PaymentAttempt", back_populates="order", cascade="all, delete-orphan")
    transaction = relationship("PaymentTransaction", back_populates="order", uselist=False)


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("payment_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    gateway_payment_id = Column(String(128), index=True, nullable=True)
    method = Column(String(32), nullable=True)  # "upi", "card", "netbanking", "wallet"
    status = Column(String(32), default="initiated")  # "initiated", "authorized", "captured", "failed"
    error_code = Column(String(64), nullable=True)
    error_description = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    order = relationship("PaymentOrder", back_populates="attempts")
    user = relationship("User", backref="payment_attempts")


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(String(36), ForeignKey("payment_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    gateway = Column(String(32), default="razorpay")
    gateway_payment_id = Column(String(128), unique=True, index=True, nullable=False)
    amount = Column(Integer, nullable=False)  # in paise
    currency = Column(String(8), default="INR")
    method = Column(String(32), nullable=True)  # "upi", "card", "netbanking", "wallet"
    vpa = Column(String(128), nullable=True)
    card_network = Column(String(32), nullable=True)
    card_last4 = Column(String(4), nullable=True)
    card_type = Column(String(16), nullable=True)  # "debit" or "credit"
    bank = Column(String(64), nullable=True)
    wallet = Column(String(64), nullable=True)
    fee = Column(Integer, default=0)  # gateway fee in paise
    tax = Column(Integer, default=0)  # gateway tax in paise
    status = Column(String(32), default="captured")  # "captured", "refunded", "partially_refunded", "failed"
    signature = Column(String(256), nullable=True)
    verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    invoice_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="payment_transactions")
    order = relationship("PaymentOrder", back_populates="transaction")
    refunds = relationship("Refund", back_populates="transaction", cascade="all, delete-orphan")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_number = Column(String(64), unique=True, index=True, nullable=False)  # e.g. "INV-2026-00001"
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(String(36), ForeignKey("payment_transactions.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id = Column(String(36), ForeignKey("payment_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    plan_tier = Column(String(32), nullable=False)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False)
    customer_address = Text()
    customer_gstin = Column(String(32), nullable=True)
    amount_subtotal = Column(Integer, nullable=False)  # in paise
    tax_rate_percent = Column(Float, default=18.0)
    tax_amount = Column(Integer, default=0)  # in paise
    cgst_amount = Column(Integer, default=0)
    sgst_amount = Column(Integer, default=0)
    amount_total = Column(Integer, nullable=False)  # in paise
    currency = Column(String(8), default="INR")
    pdf_path = Column(String(512), nullable=True)
    status = Column(String(32), default="paid")  # "paid", "refunded", "void"
    issued_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="invoices")
    transaction = relationship("PaymentTransaction", backref="invoice_ref")


class Refund(Base):
    __tablename__ = "refunds"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(String(36), ForeignKey("payment_transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    gateway_refund_id = Column(String(128), unique=True, index=True, nullable=True)
    amount = Column(Integer, nullable=False)  # in paise
    currency = Column(String(8), default="INR")
    status = Column(String(32), default="pending")  # "pending", "processed", "failed"
    reason = Column(String(128), default="customer_request")
    requested_by = Column(String(32), default="customer")  # "customer" or "admin"
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="refunds")
    transaction = relationship("PaymentTransaction", back_populates="refunds")


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_id = Column(String(128), unique=True, index=True, nullable=False)  # IDEMPOTENCY KEY
    event_type = Column(String(64), index=True, nullable=False)
    gateway = Column(String(32), default="razorpay")
    payload = Column(Text, nullable=False)
    is_verified = Column(Boolean, default=False)
    is_processed = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SubscriptionEvent(Base):
    __tablename__ = "subscription_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(String(36), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)  # "created", "upgraded", "renewed", "cancelled", "expired", "failed_payment"
    from_tier = Column(String(32), nullable=True)
    to_tier = Column(String(32), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="subscription_events")
    subscription = relationship("Subscription", backref="events")
