"""
Production-Ready Payment API Endpoints.
Integrates Razorpay Standard Checkout, server-side Orders API, cryptographic signature verification,
webhook processing with idempotency, tax invoicing, and subscription activations.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings, BASE_DIR
from app.models.user import User, Subscription
from app.models.payment import (
    PaymentOrder,
    PaymentAttempt,
    PaymentTransaction,
    Invoice,
    Refund,
    WebhookEvent,
    SubscriptionEvent
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.pricing import PricingEngine
from app.services.razorpay_service import RazorpayService, RazorpayServiceError
from app.services.subscription_service import SubscriptionService
from app.services.invoice_generator import InvoiceGenerator

logger = logging.getLogger("bricdoc.payments")
router = APIRouter()


# -----------------------------------------------------------------------------
# Request & Response Schemas
# -----------------------------------------------------------------------------
class CreateOrderRequest(BaseModel):
    plan: str = "pro"  # "pro" or "business"
    currency: str = "INR"
    billing_name: Optional[str] = None
    billing_email: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    billing_name: Optional[str] = None
    billing_email: Optional[str] = None
    billing_address: Optional[str] = None


class SetKeysRequest(BaseModel):
    razorpay_key_id: str
    razorpay_key_secret: str
    razorpay_webhook_secret: Optional[str] = None


class RefundRequest(BaseModel):
    transaction_id: str
    reason: Optional[str] = "Customer requested refund"
    amount_paise: Optional[int] = None  # None = full refund


# -----------------------------------------------------------------------------
# Configuration & Management
# -----------------------------------------------------------------------------
@router.get("/config")
def get_payment_config(current_user: Optional[User] = Depends(get_current_user)):
    """
    Returns public gateway configuration, active key IDs, and verified server pricing.
    """
    is_configured = RazorpayService.is_configured()
    key_id = RazorpayService.get_key_id()
    mode = RazorpayService.get_mode()
    catalog = PricingEngine.get_public_catalog()

    user_sub = None
    if current_user:
        sub = current_user.subscription
        if sub:
            user_sub = {
                "plan_tier": sub.plan_tier,
                "status": sub.status,
                "first_time_offer_used": sub.first_time_offer_used,
                "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None
            }

    return {
        "gateway": "razorpay",
        "is_configured": is_configured,
        "razorpay_key_id": key_id,
        "mode": mode,
        "pricing_catalog": catalog,
        "supported_methods": ["upi", "card", "netbanking", "wallet"],
        "user_subscription": user_sub
    }


@router.post("/set-keys")
def set_payment_keys(
    req: SetKeysRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Connects or updates Razorpay Merchant API keys (Test or Live mode).
    Validates credentials with live Razorpay server before saving persistently to .env.
    """
    cleaned_id = req.razorpay_key_id.strip()
    cleaned_secret = req.razorpay_key_secret.strip()
    cleaned_webhook = req.razorpay_webhook_secret.strip() if req.razorpay_webhook_secret else None

    if not cleaned_id or not cleaned_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both Razorpay Key ID and Key Secret are required."
        )

    # Validate against Razorpay API
    import httpx
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get("https://api.razorpay.com/v1/orders", auth=(cleaned_id, cleaned_secret))
            if res.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Razorpay credentials. Razorpay rejected this Key ID / Key Secret combination."
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Razorpay key check warning: {e}")

    # Update in-memory settings
    settings.RAZORPAY_KEY_ID = cleaned_id
    settings.RAZORPAY_KEY_SECRET = cleaned_secret
    if cleaned_webhook:
        settings.RAZORPAY_WEBHOOK_SECRET = cleaned_webhook

    # Persist to backend/.env
    env_file = BASE_DIR / ".env"
    env_lines = []
    if env_file.exists():
        env_lines = env_file.read_text(encoding="utf-8").splitlines()

    new_lines = []
    keys_updated = {"RAZORPAY_KEY_ID": False, "RAZORPAY_KEY_SECRET": False, "RAZORPAY_WEBHOOK_SECRET": False}

    for line in env_lines:
        line_strip = line.strip()
        if line_strip.startswith("RAZORPAY_KEY_ID="):
            new_lines.append(f"RAZORPAY_KEY_ID={cleaned_id}")
            keys_updated["RAZORPAY_KEY_ID"] = True
        elif line_strip.startswith("RAZORPAY_KEY_SECRET="):
            new_lines.append(f"RAZORPAY_KEY_SECRET={cleaned_secret}")
            keys_updated["RAZORPAY_KEY_SECRET"] = True
        elif line_strip.startswith("RAZORPAY_WEBHOOK_SECRET=") and cleaned_webhook:
            new_lines.append(f"RAZORPAY_WEBHOOK_SECRET={cleaned_webhook}")
            keys_updated["RAZORPAY_WEBHOOK_SECRET"] = True
        else:
            new_lines.append(line)

    if not keys_updated["RAZORPAY_KEY_ID"]:
        new_lines.append(f"RAZORPAY_KEY_ID={cleaned_id}")
    if not keys_updated["RAZORPAY_KEY_SECRET"]:
        new_lines.append(f"RAZORPAY_KEY_SECRET={cleaned_secret}")
    if cleaned_webhook and not keys_updated["RAZORPAY_WEBHOOK_SECRET"]:
        new_lines.append(f"RAZORPAY_WEBHOOK_SECRET={cleaned_webhook}")

    try:
        env_file.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    except Exception as e:
        logger.error(f"Could not persist keys to .env: {e}")

    is_test = cleaned_id.startswith("rzp_test_")
    return {
        "success": True,
        "message": f"Successfully connected Razorpay ({'Test Mode' if is_test else 'Live Production Mode'}). Keys are active.",
        "key_id": cleaned_id,
        "mode": "test" if is_test else "live"
    }


# -----------------------------------------------------------------------------
# Orders & Checkout
# -----------------------------------------------------------------------------
@router.post("/create-order")
def create_payment_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates an authentic Razorpay Order via server-side Orders API.
    Enforces server-authoritative pricing and prevents duplicate subscriptions.
    """
    plan = req.plan.lower().strip()
    if plan not in ("pro", "business"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan '{plan}'. Supported plans are 'pro' and 'business'."
        )

    # Check for active subscription duplication
    sub = current_user.subscription
    if sub and sub.status == "active" and sub.plan_tier == plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have an active {plan.capitalize()} subscription."
        )

    # Authoritative price calculation
    try:
        is_promo_eligible = not (sub and sub.first_time_offer_used)
        calc = PricingEngine.calculate_order(
            plan_tier=plan,
            first_time_offer_eligible=is_promo_eligible,
            tax_rate_percent=settings.TAX_RATE_PERCENT
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Verify Razorpay gateway is configured
    if not RazorpayService.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay payment gateway credentials are not configured. Please connect your Razorpay Key ID and Secret in settings."
        )

    receipt = f"rcpt_{current_user.id[:8]}_{int(datetime.now(timezone.utc).timestamp())}"
    notes = {
        "user_id": current_user.id,
        "user_email": current_user.email,
        "plan_tier": plan,
        "is_intro_promo": str(calc["is_promo"]),
        "app": "BricDoc"
    }

    try:
        gateway_order = RazorpayService.create_order(
            amount_paise=calc["amount_paise"],
            currency=calc["currency"],
            receipt=receipt,
            notes=notes
        )
    except RazorpayServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    gateway_order_id = gateway_order.get("id")
    if not gateway_order_id:
        raise HTTPException(status_code=500, detail="Could not retrieve Order ID from Razorpay.")

    # Persist Order in database
    order_record = PaymentOrder(
        user_id=current_user.id,
        gateway="razorpay",
        gateway_order_id=gateway_order_id,
        amount=calc["amount_paise"],
        currency=calc["currency"],
        plan_tier=plan,
        status="created",
        receipt=receipt,
        notes=json.dumps(notes),
        billing_name=req.billing_name or current_user.full_name,
        billing_email=req.billing_email or current_user.email
    )
    db.add(order_record)
    db.flush()

    # Initial attempt record
    attempt = PaymentAttempt(
        order_id=order_record.id,
        user_id=current_user.id,
        status="initiated"
    )
    db.add(attempt)
    db.commit()
    db.refresh(order_record)

    return {
        "success": True,
        "order_id": gateway_order_id,
        "amount": calc["amount_paise"],
        "currency": calc["currency"],
        "amount_inr": calc["amount_inr"],
        "subtotal_inr": calc["subtotal_paise"] / 100.0,
        "tax_inr": calc["tax_paise"] / 100.0,
        "tax_rate": calc["tax_rate_percent"],
        "is_intro_promo": calc["is_promo"],
        "key_id": RazorpayService.get_key_id(),
        "name": "BricDoc Workspace",
        "description": f"BricDoc {plan.capitalize()} Membership",
        "prefill": {
            "name": current_user.full_name or "BricDoc Member",
            "email": current_user.email,
        },
        "theme": {
            "color": "#4f46e5"
        }
    }


# -----------------------------------------------------------------------------
# Payment Verification
# -----------------------------------------------------------------------------
@router.post("/verify")
def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cryptographically verifies Razorpay payment HMAC-SHA256 signature and captures payment.
    Activates the subscription and automatically generates a PDF tax invoice.
    """
    order = db.query(PaymentOrder).filter(
        PaymentOrder.gateway_order_id == req.razorpay_order_id,
        PaymentOrder.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found or does not belong to the current user."
        )

    # Idempotency check: Already paid
    if order.status == "paid":
        trans = order.transaction
        return {
            "success": True,
            "message": "Payment already verified and subscription is active.",
            "plan_tier": order.plan_tier,
            "order_id": order.gateway_order_id,
            "payment_id": trans.gateway_payment_id if trans else None,
            "invoice_id": trans.invoice_id if trans else None
        }

    # Cryptographic Signature Verification
    is_valid_sig = RazorpayService.verify_payment_signature(
        order_id=req.razorpay_order_id,
        payment_id=req.razorpay_payment_id,
        signature=req.razorpay_signature
    )

    if not is_valid_sig:
        # Mark attempt failed
        attempt = PaymentAttempt(
            order_id=order.id,
            user_id=current_user.id,
            gateway_payment_id=req.razorpay_payment_id,
            status="failed",
            error_code="SIGNATURE_MISMATCH",
            error_description="Cryptographic HMAC-SHA256 signature verification failed."
        )
        db.add(attempt)
        order.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cryptographic payment signature mismatch. Payment verification failed."
        )

    # Fetch live payment details from Razorpay to verify capture status
    pay_details = {}
    try:
        pay_details = RazorpayService.fetch_payment(req.razorpay_payment_id)
        pay_status = pay_details.get("status")

        if pay_status == "authorized":
            # Auto-capture authorized payment
            pay_details = RazorpayService.capture_payment(
                payment_id=req.razorpay_payment_id,
                amount_paise=order.amount,
                currency=order.currency
            )
            pay_status = pay_details.get("status")

        if pay_status != "captured":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Razorpay payment status is '{pay_status}'. Only captured payments activate subscriptions."
            )
    except RazorpayServiceError as e:
        logger.error(f"Error fetching/capturing payment from Razorpay: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # Mark order as paid
    order.status = "paid"
    order.updated_at = datetime.now(timezone.utc)

    # Extract payment method metadata
    method = pay_details.get("method", "upi")
    vpa = pay_details.get("vpa")
    card_info = pay_details.get("card") or {}
    card_network = card_info.get("network")
    card_last4 = card_info.get("last4")
    card_type = card_info.get("type")
    bank = pay_details.get("bank")
    wallet = pay_details.get("wallet")
    fee = pay_details.get("fee", 0)
    tax = pay_details.get("tax", 0)

    # Create PaymentTransaction
    transaction = PaymentTransaction(
        user_id=current_user.id,
        order_id=order.id,
        gateway="razorpay",
        gateway_payment_id=req.razorpay_payment_id,
        amount=order.amount,
        currency=order.currency,
        method=method,
        vpa=vpa,
        card_network=card_network,
        card_last4=card_last4,
        card_type=card_type,
        bank=bank,
        wallet=wallet,
        fee=fee,
        tax=tax,
        status="captured",
        signature=req.razorpay_signature,
        verified_at=datetime.now(timezone.utc)
    )
    db.add(transaction)
    db.flush()

    # Record successful attempt
    attempt = PaymentAttempt(
        order_id=order.id,
        user_id=current_user.id,
        gateway_payment_id=req.razorpay_payment_id,
        method=method,
        status="captured"
    )
    db.add(attempt)

    # Activate Subscription & Generate Invoice via SubscriptionService
    b_name = req.billing_name or order.billing_name or current_user.full_name or "Customer"
    b_email = req.billing_email or order.billing_email or current_user.email
    b_address = req.billing_address or "India"

    sub_result = SubscriptionService.activate_or_upgrade(
        db=db,
        user=current_user,
        order=order,
        transaction=transaction,
        billing_name=b_name,
        billing_email=b_email,
        billing_address=b_address
    )

    return {
        "success": True,
        "message": f"Payment verified successfully! BricDoc {order.plan_tier.capitalize()} has been activated.",
        "plan_tier": order.plan_tier,
        "payment_id": req.razorpay_payment_id,
        "order_id": order.gateway_order_id,
        "invoice_id": sub_result.get("invoice_id"),
        "invoice_number": sub_result.get("invoice_number"),
        "current_period_end": sub_result.get("current_period_end")
    }


# -----------------------------------------------------------------------------
# Webhook Processing (Cryptographic Verification + Idempotency)
# -----------------------------------------------------------------------------
@router.post("/webhook")
async def process_razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Razorpay Webhook Endpoint.
    Validates cryptographic raw body HMAC-SHA256 signature and guarantees idempotency.
    Docs: https://razorpay.com/docs/webhooks/
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not signature:
        logger.warning("Webhook received without X-Razorpay-Signature header.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header."
        )

    # Cryptographic signature verification
    is_valid = RazorpayService.verify_webhook_signature(raw_body=raw_body, signature=signature)
    if not is_valid:
        logger.error("Razorpay webhook signature verification failed.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cryptographic webhook signature."
        )

    try:
        event_data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON payload: {e}")

    event_id = event_data.get("event_id") or f"evt_{hash(raw_body)}"
    event_type = event_data.get("event", "unknown")

    # Idempotency check: Look up event_id
    existing_event = db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first()
    if existing_event and existing_event.is_processed:
        logger.info(f"Duplicate webhook event '{event_id}' skipped (already processed).")
        return {"status": "already_processed", "event_id": event_id}

    if not existing_event:
        existing_event = WebhookEvent(
            event_id=event_id,
            event_type=event_type,
            payload=raw_body.decode("utf-8"),
            is_verified=True,
            is_processed=False
        )
        db.add(existing_event)
        db.commit()

    # Process events
    try:
        payload = event_data.get("payload", {})

        if event_type in ("order.paid", "payment.captured"):
            payment_entity = payload.get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")

            if order_id:
                order = db.query(PaymentOrder).filter(PaymentOrder.gateway_order_id == order_id).first()
                if order and order.status != "paid":
                    user = db.query(User).filter(User.id == order.user_id).first()
                    if user:
                        # Create transaction
                        transaction = PaymentTransaction(
                            user_id=user.id,
                            order_id=order.id,
                            gateway="razorpay",
                            gateway_payment_id=payment_id,
                            amount=order.amount,
                            currency=order.currency,
                            method=payment_entity.get("method"),
                            status="captured",
                            verified_at=datetime.now(timezone.utc)
                        )
                        db.add(transaction)
                        db.flush()

                        order.status = "paid"
                        order.updated_at = datetime.now(timezone.utc)

                        SubscriptionService.activate_or_upgrade(
                            db=db,
                            user=user,
                            order=order,
                            transaction=transaction,
                            billing_name=order.billing_name or user.full_name,
                            billing_email=order.billing_email or user.email
                        )

        elif event_type == "payment.failed":
            payment_entity = payload.get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            if order_id:
                order = db.query(PaymentOrder).filter(PaymentOrder.gateway_order_id == order_id).first()
                if order:
                    order.status = "failed"
                    attempt = PaymentAttempt(
                        order_id=order.id,
                        user_id=order.user_id,
                        gateway_payment_id=payment_entity.get("id"),
                        status="failed",
                        error_code=payment_entity.get("error_code"),
                        error_description=payment_entity.get("error_description")
                    )
                    db.add(attempt)
                    db.commit()

        elif event_type == "refund.processed":
            refund_entity = payload.get("refund", {}).get("entity", {})
            refund_id = refund_entity.get("id")
            if refund_id:
                ref = db.query(Refund).filter(Refund.gateway_refund_id == refund_id).first()
                if ref:
                    ref.status = "processed"
                    ref.updated_at = datetime.now(timezone.utc)
                    db.commit()

        existing_event.is_processed = True
        existing_event.processed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        existing_event.error_message = str(e)
        db.commit()
        logger.error(f"Error handling webhook event '{event_id}': {e}")
        return {"status": "error_handled", "error": str(e)}

    return {"status": "ok", "event_id": event_id}


# -----------------------------------------------------------------------------
# Status, History & Invoices
# -----------------------------------------------------------------------------
@router.get("/status/{order_id}")
def get_payment_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches real-time payment and order status from database and Razorpay API.
    """
    order = db.query(PaymentOrder).filter(
        PaymentOrder.gateway_order_id == order_id,
        PaymentOrder.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    razorpay_status = None
    if RazorpayService.is_configured():
        try:
            rzp_order = RazorpayService.fetch_order(order_id)
            razorpay_status = rzp_order.get("status")
        except Exception:
            pass

    return {
        "order_id": order.gateway_order_id,
        "plan_tier": order.plan_tier,
        "amount": order.amount,
        "currency": order.currency,
        "db_status": order.status,
        "razorpay_status": razorpay_status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "is_paid": order.status == "paid"
    }


@router.get("/history")
def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists user's authentic payment transactions with tax invoices and timestamps.
    """
    transactions = db.query(PaymentTransaction).filter(
        PaymentTransaction.user_id == current_user.id
    ).order_by(PaymentTransaction.created_at.desc()).all()

    items = []
    for t in transactions:
        inv = db.query(Invoice).filter(Invoice.transaction_id == t.id).first()
        items.append({
            "id": t.id,
            "payment_id": t.gateway_payment_id,
            "amount_paise": t.amount,
            "amount_inr": t.amount / 100.0,
            "currency": t.currency,
            "method": t.method,
            "status": t.status,
            "invoice_id": inv.id if inv else None,
            "invoice_number": inv.invoice_number if inv else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    return {
        "total": len(items),
        "transactions": items
    }


@router.get("/invoices")
def get_user_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all generated tax invoices for the user."""
    invoices = db.query(Invoice).filter(
        Invoice.user_id == current_user.id
    ).order_by(Invoice.created_at.desc()).all()

    return {
        "total": len(invoices),
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "plan_tier": inv.plan_tier,
                "amount_subtotal_inr": inv.amount_subtotal / 100.0,
                "tax_amount_inr": inv.tax_amount / 100.0,
                "amount_total_inr": inv.amount_total / 100.0,
                "currency": inv.currency,
                "status": inv.status,
                "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
                "download_url": f"/api/v1/payments/invoices/{inv.id}/download"
            }
            for inv in invoices
        ]
    }


@router.get("/invoices/{invoice_id}/download")
def download_invoice_pdf(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downloads the official PDF Tax Invoice.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if inv.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized access to this invoice.")

    # Check if PDF exists on disk, otherwise generate
    pdf_path = inv.pdf_path
    if not pdf_path or not os.path.exists(pdf_path):
        trans = db.query(PaymentTransaction).filter(PaymentTransaction.id == inv.transaction_id).first()
        order = db.query(PaymentOrder).filter(PaymentOrder.id == inv.order_id).first()
        pdf_path = InvoiceGenerator.generate_pdf(
            invoice=inv,
            user=current_user,
            order=order,
            transaction=trans
        )
        inv.pdf_path = pdf_path
        db.commit()

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="Could not generate PDF invoice.")

    filename = f"{inv.invoice_number}.pdf"
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# -----------------------------------------------------------------------------
# Customer Refund Request
# -----------------------------------------------------------------------------
@router.post("/refund")
def request_refund(
    req: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiates a customer refund request for an authentic payment.
    """
    trans = db.query(PaymentTransaction).filter(
        PaymentTransaction.id == req.transaction_id,
        PaymentTransaction.user_id == current_user.id
    ).first()

    if not trans:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if trans.status != "captured":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot refund transaction with status '{trans.status}'."
        )

    # Check for existing refund
    existing_ref = db.query(Refund).filter(
        Refund.transaction_id == trans.id,
        Refund.status.in_(("pending", "processed"))
    ).first()
    if existing_ref:
        raise HTTPException(status_code=400, detail="A refund request has already been placed for this transaction.")

    refund_amount = req.amount_paise or trans.amount

    # Attempt gateway refund if live
    gateway_refund_id = None
    refund_status = "pending"

    if RazorpayService.is_configured():
        try:
            rzp_refund = RazorpayService.create_refund(
                payment_id=trans.gateway_payment_id,
                amount_paise=refund_amount,
                notes={"reason": req.reason or "Customer request", "user_id": current_user.id}
            )
            gateway_refund_id = rzp_refund.get("id")
            refund_status = "processed"
            trans.status = "refunded" if refund_amount == trans.amount else "partially_refunded"
        except RazorpayServiceError as e:
            logger.warning(f"Direct gateway refund deferred: {e.message}")
            refund_status = "pending"

    refund_record = Refund(
        user_id=current_user.id,
        transaction_id=trans.id,
        gateway_refund_id=gateway_refund_id,
        amount=refund_amount,
        currency=trans.currency,
        status=refund_status,
        reason=req.reason or "Customer requested refund",
        requested_by="customer"
    )
    db.add(refund_record)
    db.commit()
    db.refresh(refund_record)

    return {
        "success": True,
        "refund_id": refund_record.id,
        "gateway_refund_id": gateway_refund_id,
        "amount_inr": refund_amount / 100.0,
        "status": refund_status,
        "message": "Refund processed successfully." if refund_status == "processed" else "Refund request submitted for review."
    }
