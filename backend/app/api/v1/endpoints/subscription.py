"""
Production Subscription Endpoints.
Connects with SubscriptionService for plan lifecycle, cancellations, reactivations,
and authoritative quota enforcement.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user_optional, get_current_user
from app.models.user import User
from app.services.subscription_service import SubscriptionService
from app.services.usage_limiter import UsageLimiter

router = APIRouter()


class CancelSubscriptionRequest(BaseModel):
    cancel_at_period_end: bool = True
    reason: Optional[str] = "Customer request"


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


@router.get("/current")
@router.get("/me")
def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full authoritative details of user's active subscription, renewal date,
    feature quotas, and payment method status.
    """
    return SubscriptionService.get_subscription_details(db=db, user=current_user)


@router.post("/cancel")
def cancel_subscription(
    req: CancelSubscriptionRequest = CancelSubscriptionRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancels current active paid subscription.
    By default, access remains active until the end of the current paid billing cycle.
    """
    sub = current_user.subscription
    if not sub or sub.plan_tier == "free" or sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You do not have an active paid subscription to cancel."
        )

    res = SubscriptionService.cancel_subscription(
        db=db,
        user=current_user,
        cancel_at_period_end=req.cancel_at_period_end,
        reason=req.reason
    )
    return res


@router.post("/reactivate")
def reactivate_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reactivates a scheduled cancellation before the period ends.
    """
    sub = current_user.subscription
    if not sub or not sub.cancel_at_period_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No scheduled cancellation found to reactivate."
        )

    res = SubscriptionService.reactivate_subscription(db=db, user=current_user)
    return res


@router.post("/claim-first-time-offer")
def claim_first_time_offer(
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Directs user to the authentic payment checkout for the $1 introductory offer.
    Never bypasses payment or activates without verified checkout.
    """
    if not current_user:
        return {
            "success": False,
            "requires_auth": True,
            "redirect_url": "/signup?plan=pro&promo=dollar1",
            "message": "Please sign up or log in to claim your $1 first-month Pro offer."
        }

    sub = current_user.subscription
    if sub and sub.first_time_offer_used:
        return {
            "success": False,
            "redirect_url": "/subscription/setup-payment?plan=pro",
            "message": "Introductory offer has already been used on this account. Proceeding to standard Pro subscription."
        }

    return {
        "success": True,
        "requires_payment": True,
        "redirect_url": "/subscription/setup-payment?plan=pro&promo=dollar1",
        "message": "Introductory offer applied. Complete checkout to activate BricDoc Pro."
    }
