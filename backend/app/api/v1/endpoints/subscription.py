from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_optional, get_current_user
from app.models.user import User, Subscription, DailyUsage
from app.services.usage_limiter import UsageLimiter

router = APIRouter()

class UpgradeRequest(BaseModel):
    plan_tier: str = "pro"
    promo_code: Optional[str] = None

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
