from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_optional, get_current_user
from app.models.user import User, Subscription, DailyUsage, PaymentMethod
from app.services.usage_limiter import UsageLimiter

router = APIRouter()

class UpgradeRequest(BaseModel):
    plan_tier: str = "pro"
    promo_code: Optional[str] = None

class SetupPaymentRequest(BaseModel):
    payment_type: str = Field(..., description="'card' or 'upi'")
    card_number: Optional[str] = None
    exp_month: Optional[str] = None
    exp_year: Optional[str] = None
    cvv: Optional[str] = None
    cardholder_name: Optional[str] = None
    upi_vpa: Optional[str] = None
    plan_tier: str = "pro"
    promo_applied: bool = True

@router.get("/usage")
def get_daily_usage(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get current daily file usage and remaining quota for authenticated user or client IP.
    """
    return UsageLimiter.get_usage(db=db, request=request, user=current_user)


@router.post("/claim-first-time-offer")
def claim_first_time_offer(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Claim the special introductory offer: First Month of BricDoc Pro for $1.
    If authenticated, immediately upgrades account to Pro with unlimited files.
    If unauthenticated, instructs frontend to route to signup with promo code applied.
    """
    if not current_user:
        return {
            "success": False,
            "requires_auth": True,
            "redirect_url": "/signup?plan=pro&promo=dollar1",
            "message": "Please sign up or log in to claim your $1 first-month Pro offer."
        }

    sub = current_user.subscription
    if not sub:
        sub = Subscription(user_id=current_user.id)
        db.add(sub)
        db.flush()

    # Apply Pro upgrade
    sub.plan_tier = "pro"
    sub.status = "active"
    sub.max_storage_bytes = 10 * 1024 * 1024 * 1024  # 10 GB
    sub.max_file_size_mb = 2048  # 2 GB
    sub.ai_credits_monthly = 500
    sub.first_time_offer_used = True
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)

    # Clear today's daily limit counter for this user so they can immediately process files
    today_str = UsageLimiter.get_today_string()
    user_identifier = f"user:{current_user.id}"
    record = db.query(DailyUsage).filter(
        DailyUsage.identifier == user_identifier,
        DailyUsage.usage_date == today_str
    ).first()
    if record:
        record.files_count = 0

    db.commit()
    db.refresh(sub)

    return {
        "success": True,
        "message": "Welcome to BricDoc Pro! Your $1 introductory offer is active. Unlimited document processing unlocked.",
        "plan_tier": "pro",
        "first_time_offer_used": True,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None
    }


@router.post("/setup-payment-method")
def setup_payment_method(
    req: SetupPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Setup Debit Card or UPI AutoPay Mandate for recurring subscription renewals.
    Activates Pro subscription with auto-renewal enabled.
    """
    payment_type = req.payment_type.lower()
    if payment_type not in ("card", "upi"):
        raise HTTPException(status_code=400, detail="Invalid payment type. Choose 'card' or 'upi'.")

    card_brand = None
    card_last4 = None

    if payment_type == "card":
        clean_num = "".join(filter(str.isdigit, req.card_number or ""))
        if len(clean_num) < 12:
            raise HTTPException(status_code=400, detail="Please enter a valid card number.")
        card_last4 = clean_num[-4:]
        if clean_num.startswith("4"):
            card_brand = "visa"
        elif clean_num.startswith("5") or clean_num.startswith("2"):
            card_brand = "mastercard"
        elif clean_num.startswith("6") or clean_num.startswith("508"):
            card_brand = "rupay"
        elif clean_num.startswith("3"):
            card_brand = "amex"
        else:
            card_brand = "card"
    else:
        vpa = (req.upi_vpa or "").strip().lower()
        if not vpa or "@" not in vpa:
            raise HTTPException(status_code=400, detail="Please enter a valid UPI VPA (e.g. yourname@okhdfcbank).")

    # Save or update payment method
    existing_pm = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == current_user.id,
        PaymentMethod.mandate_status == "active"
    ).first()

    if not existing_pm:
        existing_pm = PaymentMethod(user_id=current_user.id)
        db.add(existing_pm)

    existing_pm.payment_type = payment_type
    existing_pm.card_brand = card_brand
    existing_pm.card_last4 = card_last4
    existing_pm.card_exp_month = req.exp_month
    existing_pm.card_exp_year = req.exp_year
    existing_pm.cardholder_name = req.cardholder_name or current_user.full_name
    existing_pm.upi_vpa = (req.upi_vpa or "").strip().lower() if payment_type == "upi" else None
    existing_pm.mandate_status = "active"
    existing_pm.mandate_amount = 12
    existing_pm.auto_renew_enabled = True

    # Upgrade subscription to Pro
    sub = current_user.subscription
    if not sub:
        sub = Subscription(user_id=current_user.id)
        db.add(sub)
        db.flush()

    sub.plan_tier = "pro"
    sub.status = "active"
    sub.max_storage_bytes = 10 * 1024 * 1024 * 1024
    sub.max_file_size_mb = 2048
    sub.ai_credits_monthly = 500
    sub.first_time_offer_used = True
    sub.auto_renew_enabled = True
    sub.payment_method_id = existing_pm.id
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)

    # Reset daily limit counter
    today_str = UsageLimiter.get_today_string()
    user_identifier = f"user:{current_user.id}"
    record = db.query(DailyUsage).filter(
        DailyUsage.identifier == user_identifier,
        DailyUsage.usage_date == today_str
    ).first()
    if record:
        record.files_count = 0

    db.commit()
    db.refresh(existing_pm)
    db.refresh(sub)

    return {
        "success": True,
        "message": f"Auto-debit mandate successfully authorized via {payment_type.upper()}. BricDoc Pro is active with unlimited files!",
        "payment_method": {
            "id": existing_pm.id,
            "type": existing_pm.payment_type,
            "brand": existing_pm.card_brand,
            "last4": existing_pm.card_last4,
            "upi_vpa": existing_pm.upi_vpa,
            "auto_renew_enabled": existing_pm.auto_renew_enabled,
        },
        "subscription": {
            "plan_tier": sub.plan_tier,
            "status": sub.status,
            "auto_renew_enabled": sub.auto_renew_enabled,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None
        }
    }


@router.get("/payment-method")
def get_payment_method(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current saved payment method, auto-renew status, and next billing date.
    """
    pm = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == current_user.id,
        PaymentMethod.mandate_status == "active"
    ).first()

    sub = current_user.subscription
    return {
        "has_payment_method": pm is not None,
        "payment_method": {
            "id": pm.id,
            "type": pm.payment_type,
            "brand": pm.card_brand,
            "last4": pm.card_last4,
            "exp_month": pm.card_exp_month,
            "exp_year": pm.card_exp_year,
            "upi_vpa": pm.upi_vpa,
            "auto_renew_enabled": pm.auto_renew_enabled,
        } if pm else None,
        "subscription": {
            "plan_tier": sub.plan_tier if sub else "free",
            "status": sub.status if sub else "active",
            "auto_renew_enabled": getattr(sub, "auto_renew_enabled", False) if sub else False,
            "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
            "renewal_price_usd": 12.0
        }
    }


@router.post("/cancel-auto-renew")
def cancel_auto_renew(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel auto-renew mandate. Current active subscription remains valid until period end.
    """
    sub = current_user.subscription
    if sub:
        sub.auto_renew_enabled = False

    pm = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == current_user.id
    ).first()
    if pm:
        pm.auto_renew_enabled = False
        pm.mandate_status = "cancelled"

    db.commit()

    return {
        "success": True,
        "message": "Auto-renewal has been cancelled. You will not be charged again. Your current Pro access remains active until the end of your billing cycle.",
        "auto_renew_enabled": False
    }


@router.post("/upgrade")
def upgrade_subscription(
    req: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upgrade authenticated user account to Pro or Business.
    """
    sub = current_user.subscription
    if not sub:
        sub = Subscription(user_id=current_user.id)
        db.add(sub)
        db.flush()

    tier = req.plan_tier.lower()
    if tier not in ("pro", "business"):
        raise HTTPException(status_code=400, detail="Invalid plan tier. Choose 'pro' or 'business'.")

    sub.plan_tier = tier
    sub.status = "active"
    if tier == "pro":
        sub.max_storage_bytes = 10 * 1024 * 1024 * 1024
        sub.max_file_size_mb = 2048
        sub.ai_credits_monthly = 500
    else:
        sub.max_storage_bytes = 100 * 1024 * 1024 * 1024
        sub.max_file_size_mb = 5120
        sub.ai_credits_monthly = 2000

    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
    db.commit()
    db.refresh(sub)

    return {
        "success": True,
        "message": f"Successfully upgraded to {tier.capitalize()}.",
        "plan_tier": tier,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None
    }
