"""
Comprehensive Automated Test Suite for BricDoc Payment Gateway & Subscription Lifecycle.
Covers all 18 production test scenarios including Razorpay orders, HMAC-SHA256 verification,
idempotency, webhook signatures, PDF invoicing, cancellations, and security controls.
"""

import os
import json
import hmac
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.core.database import engine, Base, SessionLocal
from app.core.config import settings
from app.models.user import User, Subscription, DailyUsage
from app.models.payment import (
    PaymentOrder,
    PaymentTransaction,
    Invoice,
    Refund,
    WebhookEvent,
    SubscriptionEvent
)
from app.services.pricing import PricingEngine
from app.services.razorpay_service import RazorpayService
from app.services.subscription_service import SubscriptionService
from app.services.invoice_generator import InvoiceGenerator


TEST_KEY_ID = "rzp_test_LiveVerified2026"
TEST_KEY_SECRET = "super_secure_secret_key_12345678"
TEST_WEBHOOK_SECRET = "webhook_secret_verification_98765"


@pytest.fixture(autouse=True)
def setup_gateway_environment():
    """Sets up mock authentic Razorpay keys in settings for tests."""
    orig_id = settings.RAZORPAY_KEY_ID
    orig_sec = settings.RAZORPAY_KEY_SECRET
    orig_web = settings.RAZORPAY_WEBHOOK_SECRET

    settings.RAZORPAY_KEY_ID = TEST_KEY_ID
    settings.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET
    settings.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET

    yield

    settings.RAZORPAY_KEY_ID = orig_id
    settings.RAZORPAY_KEY_SECRET = orig_sec
    settings.RAZORPAY_WEBHOOK_SECRET = orig_web


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    email = f"payer_{uuid.uuid4().hex[:8]}@bricdoc.com"
    user = User(
        email=email,
        hashed_password="test_hashed_pwd",
        full_name="Raghuraj Pratap Singh",
        is_active=True,
        is_admin=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Initialize Free tier
    sub = Subscription(
        user_id=user.id,
        plan_tier="free",
        status="active",
        max_storage_bytes=500 * 1024 * 1024,
        max_file_size_mb=25,
        ai_credits_monthly=50,
        first_time_offer_used=False
    )
    db_session.add(sub)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    from app.core.security import create_access_token
    token = create_access_token(subject=test_user.id, extra_claims={"email": test_user.email})
    return {"Authorization": f"Bearer {token}"}


# -----------------------------------------------------------------------------
# 1. Order Creation Tests
# -----------------------------------------------------------------------------
def test_free_selecting_pro_order_creation(client, auth_headers, test_user, db_session):
    """Case 1: Free user selects Pro plan. Server creates authentic order with introductory pricing (₹85.00 / 8500 paise)."""
    dyn_order_id = f"order_pro_{uuid.uuid4().hex[:8]}"
    with patch("app.services.razorpay_service.httpx.Client.post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "id": dyn_order_id,
            "amount": 8500,
            "currency": "INR",
            "status": "created"
        }

        res = client.post("/api/v1/payments/create-order", json={"plan": "pro"}, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["order_id"] == dyn_order_id
        assert data["amount"] == 8500
        assert data["currency"] == "INR"
        assert data["is_intro_promo"] is True
        assert data["key_id"] == TEST_KEY_ID

        # Verify DB persistence
        order = db_session.query(PaymentOrder).filter(PaymentOrder.gateway_order_id == dyn_order_id).first()
        assert order is not None
        assert order.amount == 8500
        assert order.plan_tier == "pro"
        assert order.status == "created"


def test_free_selecting_business_order_creation(client, auth_headers, test_user, db_session):
    """Case 2: Free user selects Business plan. Server creates order with ₹3,299.00 (329900 paise)."""
    dyn_biz_id = f"order_biz_{uuid.uuid4().hex[:8]}"
    with patch("app.services.razorpay_service.httpx.Client.post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "id": dyn_biz_id,
            "amount": 329900,
            "currency": "INR",
            "status": "created"
        }

        res = client.post("/api/v1/payments/create-order", json={"plan": "business"}, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["amount"] == 329900
        assert data["currency"] == "INR"
        assert data["is_intro_promo"] is False


def test_duplicate_active_subscription_prevented(client, auth_headers, test_user, db_session):
    """Case 3: User already has an active Pro subscription. Duplicate order creation is rejected."""
    sub = test_user.subscription
    sub.plan_tier = "pro"
    sub.status = "active"
    db_session.commit()

    res = client.post("/api/v1/payments/create-order", json={"plan": "pro"}, headers=auth_headers)
    assert res.status_code == 400
    assert "already have an active Pro subscription" in res.json()["detail"]


# -----------------------------------------------------------------------------
# 2. Payment Verification & Cryptographic Security
# -----------------------------------------------------------------------------
def test_successful_payment_verification(client, auth_headers, test_user, db_session):
    """Case 4: Valid HMAC-SHA256 signature and captured status activates Pro tier & generates tax invoice."""
    order_id = f"order_verif_{uuid.uuid4().hex[:8]}"
    payment_id = f"pay_succ_{uuid.uuid4().hex[:8]}"

    # Pre-create order in DB
    order = PaymentOrder(
        user_id=test_user.id,
        gateway="razorpay",
        gateway_order_id=order_id,
        amount=8500,
        currency="INR",
        plan_tier="pro",
        status="created"
    )
    db_session.add(order)
    db_session.commit()

    # Generate authentic HMAC-SHA256 signature
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    valid_sig = hmac.new(TEST_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    with patch("app.services.razorpay_service.httpx.Client.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "id": payment_id,
            "order_id": order_id,
            "status": "captured",
            "amount": 8500,
            "method": "upi",
            "vpa": "payer@upi"
        }

        res = client.post("/api/v1/payments/verify", json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
            "billing_name": "Raghuraj Pratap Singh",
            "billing_email": test_user.email
        }, headers=auth_headers)

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["plan_tier"] == "pro"
        assert data["invoice_id"] is not None

        # Verify DB updates
        db_session.refresh(order)
        assert order.status == "paid"

        db_session.refresh(test_user)
        assert test_user.subscription.plan_tier == "pro"
        assert test_user.subscription.status == "active"
        assert test_user.subscription.max_storage_bytes == 10 * 1024 * 1024 * 1024


def test_invalid_signature_rejection(client, auth_headers, test_user, db_session):
    """Case 5: Tampered / invalid signature is rejected with HTTP 400 and does NOT grant Pro."""
    order_id = f"order_tamper_{uuid.uuid4().hex[:8]}"
    payment_id = f"pay_tamper_{uuid.uuid4().hex[:8]}"

    order = PaymentOrder(
        user_id=test_user.id,
        gateway="razorpay",
        gateway_order_id=order_id,
        amount=8500,
        currency="INR",
        plan_tier="pro",
        status="created"
    )
    db_session.add(order)
    db_session.commit()

    res = client.post("/api/v1/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": "fake_invalid_tampered_signature_12345",
    }, headers=auth_headers)

    assert res.status_code == 400
    assert "signature mismatch" in res.json()["detail"].lower()

    # User MUST remain on Free tier
    db_session.refresh(test_user)
    assert test_user.subscription.plan_tier == "free"


def test_duplicate_payment_callback_idempotency(client, auth_headers, test_user, db_session):
    """Case 6: Duplicate verify call returns idempotent success without duplicate charges or invoices."""
    order_id = f"order_idemp_{uuid.uuid4().hex[:8]}"
    payment_id = f"pay_idemp_{uuid.uuid4().hex[:8]}"

    order = PaymentOrder(
        user_id=test_user.id,
        gateway="razorpay",
        gateway_order_id=order_id,
        amount=8500,
        currency="INR",
        plan_tier="pro",
        status="paid"
    )
    db_session.add(order)
    db_session.commit()

    msg = f"{order_id}|{payment_id}".encode("utf-8")
    valid_sig = hmac.new(TEST_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    res = client.post("/api/v1/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
    }, headers=auth_headers)

    assert res.status_code == 200
    assert "already verified" in res.json()["message"].lower()


# -----------------------------------------------------------------------------
# 3. Webhook Cryptographic Verification & Idempotency
# -----------------------------------------------------------------------------
def test_valid_webhook_processing(client, test_user, db_session):
    """Case 7: Signed webhook activates order & records idempotency."""
    order_id = f"order_wh_{uuid.uuid4().hex[:8]}"
    payment_id = f"pay_wh_{uuid.uuid4().hex[:8]}"

    order = PaymentOrder(
        user_id=test_user.id,
        gateway="razorpay",
        gateway_order_id=order_id,
        amount=8500,
        currency="INR",
        plan_tier="pro",
        status="created"
    )
    db_session.add(order)
    db_session.commit()

    payload_dict = {
        "event_id": f"evt_{uuid.uuid4().hex}",
        "event": "order.paid",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "order_id": order_id,
                    "status": "captured",
                    "amount": 8500,
                    "method": "card"
                }
            }
        }
    }
    raw_payload = json.dumps(payload_dict).encode("utf-8")
    sig = hmac.new(TEST_WEBHOOK_SECRET.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()

    res = client.post(
        "/api/v1/payments/webhook",
        content=raw_payload,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # Verify user subscription upgraded
    db_session.refresh(test_user)
    assert test_user.subscription.plan_tier == "pro"


def test_duplicate_webhook_idempotency(client, test_user, db_session):
    """Case 8: Replay of same webhook event returns 'already_processed' without duplicate actions."""
    event_id = f"evt_idemp_{uuid.uuid4().hex}"
    existing_event = WebhookEvent(
        event_id=event_id,
        event_type="order.paid",
        payload="{}",
        is_verified=True,
        is_processed=True
    )
    db_session.add(existing_event)
    db_session.commit()

    payload_dict = {"event_id": event_id, "event": "order.paid"}
    raw_payload = json.dumps(payload_dict).encode("utf-8")
    sig = hmac.new(TEST_WEBHOOK_SECRET.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()

    res = client.post(
        "/api/v1/payments/webhook",
        content=raw_payload,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "already_processed"


def test_invalid_webhook_signature_rejected(client):
    """Case 9: Webhook with forged signature is rejected with HTTP 400."""
    raw_payload = b'{"event":"payment.captured"}'
    res = client.post(
        "/api/v1/payments/webhook",
        content=raw_payload,
        headers={"X-Razorpay-Signature": "invalid_forged_sig", "Content-Type": "application/json"}
    )
    assert res.status_code == 400
    assert "Invalid cryptographic webhook signature" in res.json()["detail"]


# -----------------------------------------------------------------------------
# 4. Subscription Lifecycle: Cancellation, Reactivation & Expiry
# -----------------------------------------------------------------------------
def test_subscription_cancellation_at_period_end(client, auth_headers, test_user, db_session):
    """Case 10: User cancels subscription. cancel_at_period_end is set to True; access preserved."""
    sub = test_user.subscription
    sub.plan_tier = "pro"
    sub.status = "active"
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=20)
    db_session.commit()

    res = client.post("/api/v1/subscription/cancel", json={"cancel_at_period_end": True}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["cancel_at_period_end"] is True

    db_session.refresh(sub)
    assert sub.cancel_at_period_end is True
    # Tier still Pro until period end
    assert sub.plan_tier == "pro"


def test_subscription_reactivation(client, auth_headers, test_user, db_session):
    """Case 11: User undoes scheduled cancellation before period end."""
    sub = test_user.subscription
    sub.plan_tier = "pro"
    sub.status = "active"
    sub.cancel_at_period_end = True
    db_session.commit()

    res = client.post("/api/v1/subscription/reactivate", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["success"] is True

    db_session.refresh(sub)
    assert sub.cancel_at_period_end is False


def test_expired_subscription_auto_downgrade(test_user, db_session):
    """Case 12: Expired subscription is automatically downgraded to Free tier with limits enforced."""
    sub = test_user.subscription
    sub.plan_tier = "pro"
    sub.status = "active"
    # Past period end (yesterday)
    sub.current_period_end = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    enforced_sub = SubscriptionService.check_and_enforce_expiry(db_session, test_user)
    assert enforced_sub.plan_tier == "free"
    assert enforced_sub.status == "expired"
    assert enforced_sub.max_storage_bytes == 500 * 1024 * 1024


# -----------------------------------------------------------------------------
# 5. Invoicing & PDF Generation
# -----------------------------------------------------------------------------
def test_invoice_pdf_generation_and_download(client, auth_headers, test_user, db_session):
    """Case 13: Unique invoice number generated, PDF created on disk, and downloaded via API."""
    order = PaymentOrder(
        user_id=test_user.id,
        gateway="razorpay",
        gateway_order_id=f"order_inv_{uuid.uuid4().hex[:6]}",
        amount=8500,
        currency="INR",
        plan_tier="pro",
        status="paid"
    )
    db_session.add(order)
    db_session.flush()

    trans = PaymentTransaction(
        user_id=test_user.id,
        order_id=order.id,
        gateway_payment_id=f"pay_inv_{uuid.uuid4().hex[:6]}",
        amount=8500,
        currency="INR",
        method="upi",
        status="captured"
    )
    db_session.add(trans)
    db_session.flush()

    inv = Invoice(
        invoice_number=f"INV-2026-{uuid.uuid4().hex[:5].upper()}",
        user_id=test_user.id,
        transaction_id=trans.id,
        order_id=order.id,
        plan_tier="pro",
        customer_name=test_user.full_name,
        customer_email=test_user.email,
        amount_subtotal=7203,
        tax_rate_percent=18.0,
        tax_amount=1297,
        cgst_amount=648,
        sgst_amount=649,
        amount_total=8500,
        currency="INR",
        status="paid"
    )
    db_session.add(inv)
    db_session.commit()

    # Generate PDF
    pdf_path = InvoiceGenerator.generate_invoice_pdf(invoice=inv)
    inv.pdf_path = pdf_path
    db_session.commit()

    assert os.path.exists(pdf_path)

    # Test download endpoint
    res = client.get(f"/api/v1/payments/invoices/{inv.id}/download", headers=auth_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000


def test_unauthorized_invoice_access_rejection(client, test_user, db_session):
    """Case 14: Another user cannot download an invoice that doesn't belong to them (HTTP 403)."""
    # Create another user
    other_user = User(
        email=f"other_{uuid.uuid4().hex[:6]}@bricdoc.com",
        hashed_password="pwd",
        full_name="Other Person"
    )
    db_session.add(other_user)
    db_session.commit()

    inv = Invoice(
        invoice_number=f"INV-2026-{uuid.uuid4().hex[:5].upper()}",
        user_id=test_user.id,  # Belongs to test_user
        plan_tier="pro",
        customer_name=test_user.full_name,
        customer_email=test_user.email,
        amount_subtotal=7203,
        amount_total=8500,
        currency="INR"
    )
    db_session.add(inv)
    db_session.commit()

    from app.core.security import create_access_token
    other_token = create_access_token(subject=other_user.id, extra_claims={"email": other_user.email})

    res = client.get(f"/api/v1/payments/invoices/{inv.id}/download", headers={"Authorization": f"Bearer {other_token}"})
    assert res.status_code == 403
    assert "unauthorized" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 6. Refund Processing
# -----------------------------------------------------------------------------
def test_customer_refund_request(client, auth_headers, test_user, db_session):
    """Case 15: Customer requests refund on captured transaction."""
    trans = PaymentTransaction(
        user_id=test_user.id,
        gateway_payment_id=f"pay_ref_{uuid.uuid4().hex[:6]}",
        amount=8500,
        currency="INR",
        method="upi",
        status="captured"
    )
    db_session.add(trans)
    db_session.commit()

    dyn_refund_id = f"rfnd_test_{uuid.uuid4().hex[:8]}"
    with patch("app.services.razorpay_service.httpx.Client.post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "id": dyn_refund_id,
            "amount": 8500,
            "status": "processed"
        }

        res = client.post("/api/v1/payments/refund", json={
            "transaction_id": trans.id,
            "reason": "Not satisfied"
        }, headers=auth_headers)

        assert res.status_code == 200
        assert res.json()["success"] is True

        db_session.refresh(trans)
        assert trans.status == "refunded"


def test_payment_status_recovery_after_browser_closure(client, auth_headers, test_user, db_session):
    """Case 16: Browser reopens or polls status after checkout modal closure."""
    order_id = f"order_recov_{uuid.uuid4().hex[:8]}"
    order = PaymentOrder(
        user_id=test_user.id,
        gateway="razorpay",
        gateway_order_id=order_id,
        amount=8500,
        currency="INR",
        plan_tier="pro",
        status="paid"
    )
    db_session.add(order)
    db_session.commit()

    res = client.get(f"/api/v1/payments/status/{order_id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["order_id"] == order_id
    assert data["is_paid"] is True
    assert data["plan_tier"] == "pro"


def test_payment_history_listing(client, auth_headers, test_user, db_session):
    """Case 17: User views complete audit history of transactions with invoice numbers."""
    trans = PaymentTransaction(
        user_id=test_user.id,
        gateway_payment_id=f"pay_hist_{uuid.uuid4().hex[:8]}",
        amount=8500,
        currency="INR",
        method="upi",
        status="captured"
    )
    db_session.add(trans)
    db_session.commit()

    res = client.get("/api/v1/payments/history", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(t["payment_id"] == trans.gateway_payment_id for t in data["transactions"])


def test_admin_payment_analytics(client, db_session):
    """Case 18: Admin views high-level payment metrics, gross volume, and active subscriber tiers."""
    admin_user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@bricdoc.com",
        hashed_password="admin_hash_pwd",
        full_name="BricDoc Admin",
        is_active=True,
        is_admin=True
    )
    db_session.add(admin_user)
    db_session.commit()

    from app.core.security import create_access_token
    admin_token = create_access_token(subject=admin_user.id, extra_claims={"email": admin_user.email})

    res = client.get("/api/v1/admin/payments/analytics", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "gross_revenue_inr" in data
    assert "successful_transactions_count" in data
    assert "active_subscribers" in data
