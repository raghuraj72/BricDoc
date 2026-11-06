from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from fastapi import Request, HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, Subscription, DailyUsage

DAILY_FREE_FILE_LIMIT = 10
FIRST_TIME_PROMO_PRICE = 1.0  # $1 for first month
REGULAR_PRO_PRICE = 12.0     # $12/month thereafter

class UsageLimiter:
    @staticmethod
    def get_client_identifier(request: Request, user: Optional[User]) -> Tuple[str, bool]:
        """
        Returns (identifier, is_pro).
        If user is authenticated and on 'pro' or 'business' tier, is_pro is True.
        """
        if user and user.subscription and user.subscription.plan_tier in ("pro", "business") and user.subscription.status == "active":
            return f"user:{user.id}", True

        if user:
            return f"user:{user.id}", False

        # Extract client IP from headers or connection
        headers = request.headers if request else {}
        cf_ip = headers.get("cf-connecting-ip")
        forwarded = headers.get("x-forwarded-for")
        real_ip = headers.get("x-real-ip")
        client_ip = (
            cf_ip
            or (forwarded.split(",")[0].strip() if forwarded else None)
            or real_ip
            or (request.client.host if request and request.client else "anonymous")
        )
        return f"ip:{client_ip}", False

    @staticmethod
    def get_today_string() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    @classmethod
    def get_usage(cls, db: Session, request: Request, user: Optional[User]) -> Dict[str, Any]:
        identifier, is_pro = cls.get_client_identifier(request, user)
        today_str = cls.get_today_string()

        # Pro / Business users have unlimited usage
        if is_pro:
            return {
                "plan_tier": user.subscription.plan_tier if user and user.subscription else "pro",
                "is_pro": True,
                "daily_limit": None,
                "daily_used": 0,
                "daily_remaining": 999999,
                "is_limit_exceeded": False,
                "first_time_offer": {
                    "eligible": False,
                    "promo_price_usd": FIRST_TIME_PROMO_PRICE,
                    "regular_price_usd": REGULAR_PRO_PRICE,
                    "discount_pct": 92
                }
            }

        record = db.query(DailyUsage).filter(
            DailyUsage.identifier == identifier,
            DailyUsage.usage_date == today_str
        ).first()

        used = record.files_count if record else 0
        remaining = max(0, DAILY_FREE_FILE_LIMIT - used)
        is_exceeded = used >= DAILY_FREE_FILE_LIMIT

        is_eligible = True
        if user and user.subscription and getattr(user.subscription, "first_time_offer_used", False):
            is_eligible = False

        return {
            "plan_tier": "free",
            "is_pro": False,
            "daily_limit": DAILY_FREE_FILE_LIMIT,
            "daily_used": used,
            "daily_remaining": remaining,
            "is_limit_exceeded": is_exceeded,
            "first_time_offer": {
                "eligible": is_eligible,
                "promo_price_usd": FIRST_TIME_PROMO_PRICE,
                "regular_price_usd": REGULAR_PRO_PRICE,
                "discount_pct": 92,
                "headline": "Special Introductory Offer: First Month for $1",
                "terms": "$1 for your first month, then $12/month. Cancel anytime."
            }
        }

    @classmethod
    def verify_not_exceeded(cls, request: Request, db: Session, user: Optional[User]):
        """
        Check if user or client IP has reached the 10 files/day limit.
        Raises HTTP 429 if limit is reached.
        """
        identifier, is_pro = cls.get_client_identifier(request, user)
        if is_pro:
            return

        today_str = cls.get_today_string()
        record = db.query(DailyUsage).filter(
            DailyUsage.identifier == identifier,
            DailyUsage.usage_date == today_str
        ).first()

        if record and record.files_count >= DAILY_FREE_FILE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="DAILY_LIMIT_EXCEEDED: You have reached your daily limit of 10 files. Upgrade to Pro for unlimited files."
            )

    @classmethod
    def increment_usage(
        cls,
        request: Request,
        db: Session,
        user: Optional[User],
        file_count: int = 1
    ) -> Dict[str, Any]:
        """
        Increment usage count after successful file processing.
        """
        identifier, is_pro = cls.get_client_identifier(request, user)
        if is_pro:
            return {"is_pro": True, "daily_remaining": 999999, "daily_used": 0}

        today_str = cls.get_today_string()
        record = db.query(DailyUsage).filter(
            DailyUsage.identifier == identifier,
            DailyUsage.usage_date == today_str
        ).first()

        if not record:
            record = DailyUsage(identifier=identifier, usage_date=today_str, files_count=0)
            db.add(record)
            db.flush()

        record.files_count += file_count
        db.commit()
        db.refresh(record)

        return {
            "is_pro": False,
            "daily_limit": DAILY_FREE_FILE_LIMIT,
            "daily_used": record.files_count,
            "daily_remaining": max(0, DAILY_FREE_FILE_LIMIT - record.files_count)
        }

    @classmethod
    def check_and_increment(
        cls,
        request: Request,
        db: Session,
        user: Optional[User],
        file_count: int = 1
    ) -> Dict[str, Any]:
        """
        Combined verify and increment in one call.
        """
        cls.verify_not_exceeded(request, db, user)
        return cls.increment_usage(request, db, user, file_count)
