"""
Subscription Management Service.
Handles plan lifecycle, upgrades, downgrades, cancellations, expiry enforcement,
invoicing, and audit trails.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.user import User, Subscription, DailyUsage, PaymentMethod
from app.models.payment import (
    PaymentOrder,
    PaymentTransaction,
    Invoice,
    SubscriptionEvent,
    Refund
)
from app.services.pricing import PricingEngine
from app.services.invoice_generator import InvoiceGenerator
from app.services.razorpay_service import RazorpayService


class SubscriptionService:
    """Core domain service for subscription lifecycle management."""

    @staticmethod
    def get_or_create_subscription(db: Session, user: User) -> Subscription:
        """Retrieves user subscription or initializes a default Free tier."""
        sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
        if not sub:
            sub = Subscription(
                user_id=user.id,
                plan_tier="free",
                status="active",
                max_storage_bytes=500 * 1024 * 1024,
                max_file_size_mb=25,
                ai_credits_monthly=50,
                first_time_offer_used=False,
                auto_renew_enabled=False,
                current_period_start=datetime.now(timezone.utc)
            )
            db.add(sub)
            db.commit()
            db.refresh(sub)
        return sub

    @staticmethod
    def check_and_enforce_expiry(db: Session, user: User) -> Subscription:
        """
        Server-side check: If paid period has expired and auto-renew did not succeed,
        downgrades account to Free tier and enforces limits.
        """
        sub = SubscriptionService.get_or_create_subscription(db, user)
        if sub.plan_tier in ("pro", "business") and sub.current_period_end:
            now_utc = datetime.now(timezone.utc)
            # Ensure timezone-aware comparison
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)

            if now_utc > period_end:
                prev_tier = sub.plan_tier
                sub.plan_tier = "free"
                sub.status = "expired"
                sub.max_storage_bytes = 500 * 1024 * 1024
                sub.max_file_size_mb = 25
                sub.ai_credits_monthly = 50
                sub.cancel_at_period_end = False

                # Log expiry event
                event = SubscriptionEvent(
                    user_id=user.id,
                    subscription_id=sub.id,
                    event_type="expired",
                    from_tier=prev_tier,
                    to_tier="free",
                    details=f"Subscription expired on {period_end.isoformat()}."
                )
                db.add(event)
                db.commit()
                db.refresh(sub)
        return sub

    @staticmethod
    def activate_or_upgrade(
        db: Session,
        user: User,
        order: PaymentOrder,
        transaction: PaymentTransaction,
        billing_name: Optional[str] = None,
        billing_email: Optional[str] = None,
        billing_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Activates or upgrades user subscription upon verified payment.
        Generates invoice, updates database in a transaction, and records audit trail.
        """
        target_tier = order.plan_tier.lower()
        plan_info = PricingEngine.get_plan(target_tier)

        sub = SubscriptionService.get_or_create_subscription(db, user)
        prev_tier = sub.plan_tier

        now_utc = datetime.now(timezone.utc)
        sub.plan_tier = target_tier
        sub.status = "active"
        sub.current_period_start = now_utc
        sub.current_period_end = now_utc + timedelta(days=30)
        sub.cancel_at_period_end = False
        sub.cancelled_at = None

        if target_tier == "pro":
            sub.first_time_offer_used = True

        limits = plan_info["limits"]
        sub.max_storage_bytes = limits["max_storage_bytes"]
        sub.max_file_size_mb = limits["max_file_size_mb"]
        sub.ai_credits_monthly = limits["ai_credits_monthly"]

        # Reset daily usage so user enjoys immediate unlimited access
        today_utc = now_utc.strftime("%Y-%m-%d")
        user_usage = db.query(DailyUsage).filter(
            DailyUsage.identifier == f"user:{user.id}",
            DailyUsage.usage_date == today_utc
        ).first()
        if user_usage:
            user_usage.files_count = 0

        # Create Invoice
        year = now_utc.strftime("%Y")
        count = db.query(Invoice).count() + 1
        invoice_number = f"INV-{year}-{count:05d}"

        order_calc = PricingEngine.calculate_order(target_tier, first_time_offer_eligible=False)
        subtotal_paise = order.amount - int(order.amount * 0.18 / 1.18)
        tax_paise = order.amount - subtotal_paise
        cgst_paise = tax_paise // 2
        sgst_paise = tax_paise - cgst_paise

        invoice = Invoice(
            invoice_number=invoice_number,
            user_id=user.id,
            transaction_id=transaction.id,
            order_id=order.id,
            plan_tier=target_tier,
            customer_name=billing_name or user.full_name or "Valued Customer",
            customer_email=billing_email or user.email,
            customer_address=billing_address,
            amount_subtotal=subtotal_paise,
            tax_rate_percent=18.0,
            tax_amount=tax_paise,
            cgst_amount=cgst_paise,
            sgst_amount=sgst_paise,
            amount_total=order.amount,
            currency=order.currency,
            status="paid",
            issued_at=now_utc
        )
        db.add(invoice)
        db.flush()

        transaction.invoice_id = invoice.id

        # Generate and save PDF Invoice
        try:
            InvoiceGenerator.generate_invoice_pdf(invoice)
        except Exception as e:
            print(f"[SubscriptionService] Warning: Could not render PDF invoice: {e}")

        # Log Subscription Event
        event_type = "upgraded" if prev_tier != target_tier else "renewed"
        sub_event = SubscriptionEvent(
            user_id=user.id,
            subscription_id=sub.id,
            event_type=event_type,
            from_tier=prev_tier,
            to_tier=target_tier,
            details=f"Payment {transaction.gateway_payment_id} verified for {order.amount / 100:.2f} {order.currency}."
        )
        db.add(sub_event)

        db.commit()
        db.refresh(sub)
        db.refresh(invoice)

        return {
            "success": True,
            "plan_tier": sub.plan_tier,
            "status": sub.status,
            "current_period_end": sub.current_period_end.isoformat(),
            "invoice_number": invoice.invoice_number,
            "invoice_id": invoice.id
        }

    @staticmethod
    def cancel_subscription(
        db: Session,
        user: User,
        cancel_at_period_end: bool = True,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cancels an active subscription.
        If cancel_at_period_end=True: user keeps paid access until current_period_end,
        after which the automated expiry logic downgrades them to Free.
        """
        sub = SubscriptionService.get_or_create_subscription(db, user)
        if sub.plan_tier == "free":
            return {"success": False, "message": "You are currently on the Free plan."}

        now_utc = datetime.now(timezone.utc)
        sub.cancel_at_period_end = True
        sub.cancelled_at = now_utc
        sub.auto_renew_enabled = False

        # If recurring subscription is active in Razorpay, attempt cancellation
        if sub.razorpay_subscription_id and RazorpayService.is_configured():
            try:
                RazorpayService.cancel_subscription(sub.razorpay_subscription_id, cancel_at_cycle_end=cancel_at_period_end)
            except Exception as e:
                print(f"[SubscriptionService] Could not cancel Razorpay subscription: {e}")

        if not cancel_at_period_end:
            # Immediate downgrade
            prev = sub.plan_tier
            sub.plan_tier = "free"
            sub.status = "cancelled"
            sub.max_storage_bytes = 500 * 1024 * 1024
            sub.max_file_size_mb = 25
            sub.ai_credits_monthly = 50

            event = SubscriptionEvent(
                user_id=user.id,
                subscription_id=sub.id,
                event_type="cancelled",
                from_tier=prev,
                to_tier="free",
                details="Subscription immediately cancelled by user."
            )
            db.add(event)
        else:
            event = SubscriptionEvent(
                user_id=user.id,
                subscription_id=sub.id,
                event_type="cancel_scheduled",
                from_tier=sub.plan_tier,
                to_tier="free",
                details=f"Subscription will expire at period end on {sub.current_period_end}."
            )
            db.add(event)

        db.commit()
        db.refresh(sub)

        return {
            "success": True,
            "message": "Subscription cancelled successfully." if not cancel_at_period_end else "Subscription will remain active until the end of your billing cycle.",
            "plan_tier": sub.plan_tier,
            "status": sub.status,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None
        }

    @staticmethod
    def reactivate_subscription(db: Session, user: User) -> Dict[str, Any]:
        """Reactivates a subscription that was scheduled for cancellation."""
        sub = SubscriptionService.get_or_create_subscription(db, user)
        if sub.plan_tier == "free" or not sub.cancel_at_period_end:
            return {"success": False, "message": "No pending cancellation found to reactivate."}

        sub.cancel_at_period_end = False
        sub.cancelled_at = None
        sub.auto_renew_enabled = True

        event = SubscriptionEvent(
            user_id=user.id,
            subscription_id=sub.id,
            event_type="reactivated",
            from_tier=sub.plan_tier,
            to_tier=sub.plan_tier,
            details="User reactivated auto-renewal before period end."
        )
        db.add(event)
        db.commit()
        db.refresh(sub)

        return {
            "success": True,
            "message": "Subscription auto-renewal reactivated.",
            "plan_tier": sub.plan_tier,
            "status": sub.status,
            "cancel_at_period_end": False
        }

    @staticmethod
    def get_subscription_details(db: Session, user: User) -> Dict[str, Any]:
        """Returns comprehensive subscription, usage, and billing metadata."""
        sub = SubscriptionService.check_and_enforce_expiry(db, user)
        plan_info = PricingEngine.get_plan(sub.plan_tier)

        # Days remaining
        days_remaining = 0
        if sub.current_period_end:
            now_utc = datetime.now(timezone.utc)
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            diff = (period_end - now_utc).days
            days_remaining = max(0, diff)

        # Fetch recent transactions
        transactions = (
            db.query(PaymentTransaction)
            .filter(PaymentTransaction.user_id == user.id)
            .order_by(PaymentTransaction.created_at.desc())
            .limit(10)
            .all()
        )

        # Fetch recent invoices
        invoices = (
            db.query(Invoice)
            .filter(Invoice.user_id == user.id)
            .order_by(Invoice.issued_at.desc())
            .limit(10)
            .all()
        )

        return {
            "plan_tier": sub.plan_tier,
            "plan_name": plan_info["name"],
            "status": sub.status,
            "is_paid": sub.plan_tier in ("pro", "business"),
            "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "days_remaining": days_remaining,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "first_time_offer_used": sub.first_time_offer_used,
            "auto_renew_enabled": sub.auto_renew_enabled,
            "limits": {
                "daily_file_limit": plan_info["limits"]["daily_file_limit"],
                "max_storage_bytes": sub.max_storage_bytes,
                "max_file_size_mb": sub.max_file_size_mb,
                "ai_credits_monthly": sub.ai_credits_monthly,
                "ai_credits_used": sub.ai_credits_used,
            },
            "recent_transactions": [
                {
                    "id": t.id,
                    "payment_id": t.gateway_payment_id,
                    "amount_inr": t.amount / 100.0,
                    "currency": t.currency,
                    "method": t.method,
                    "status": t.status,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "invoice_id": t.invoice_id
                }
                for t in transactions
            ],
            "recent_invoices": [
                {
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "plan_tier": inv.plan_tier,
                    "amount_total_inr": inv.amount_total / 100.0,
                    "currency": inv.currency,
                    "status": inv.status,
                    "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
                    "has_pdf": bool(inv.pdf_path)
                }
                for inv in invoices
            ]
        }
