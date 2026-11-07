import os
import shutil
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User, Subscription
from app.models.document import Document
from app.models.job import ProcessingJob
from app.models.audit import AuditLog
from app.models.payment import (
    PaymentOrder,
    PaymentTransaction,
    Invoice,
    Refund,
    WebhookEvent
)
from app.services.razorpay_service import RazorpayService, RazorpayServiceError

router = APIRouter()


class AdminRefundRequest(BaseModel):
    transaction_id: str
    amount_paise: Optional[int] = None
    reason: Optional[str] = "Admin issued refund"
    admin_notes: Optional[str] = None


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required."
        )
    return current_user


@router.get("/health")
def system_health():
    """Public system health check endpoint."""
    total, used, free = shutil.disk_usage(settings.STORAGE_DIR)
    return {
        "status": "healthy",
        "service": "BricDoc API",
        "version": settings.VERSION,
        "storage": {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2)
        }
    }


@router.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """System-wide operational metrics for administrator."""
    user_count = db.query(func.count(User.id)).scalar()
    doc_count = db.query(func.count(Document.id)).scalar()
    total_bytes = db.query(func.sum(Document.file_size_bytes)).scalar() or 0
    job_count = db.query(func.count(ProcessingJob.id)).scalar()

    return {
        "total_users": user_count,
        "total_documents": doc_count,
        "total_storage_bytes": total_bytes,
        "total_jobs_run": job_count
    }


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Retrieve system security audit trail."""
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()


# -----------------------------------------------------------------------------
# Admin Payment Analytics & Management
# -----------------------------------------------------------------------------
@router.get("/payments/analytics")
def get_payment_analytics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Overview of total volume, gross revenue, success rate, refunds, and subscriptions.
    """
    total_revenue_paise = db.query(func.sum(PaymentTransaction.amount)).filter(
        PaymentTransaction.status.in_(("captured", "partially_refunded"))
    ).scalar() or 0

    successful_payments = db.query(func.count(PaymentTransaction.id)).filter(
        PaymentTransaction.status.in_(("captured", "partially_refunded"))
    ).scalar() or 0

    failed_orders = db.query(func.count(PaymentOrder.id)).filter(
        PaymentOrder.status == "failed"
    ).scalar() or 0

    total_refunds_paise = db.query(func.sum(Refund.amount)).filter(
        Refund.status == "processed"
    ).scalar() or 0

    active_pro = db.query(func.count(Subscription.id)).filter(
        Subscription.plan_tier == "pro",
        Subscription.status == "active"
    ).scalar() or 0

    active_business = db.query(func.count(Subscription.id)).filter(
        Subscription.plan_tier == "business",
        Subscription.status == "active"
    ).scalar() or 0

    return {
        "gross_revenue_inr": total_revenue_paise / 100.0,
        "total_refunded_inr": total_refunds_paise / 100.0,
        "net_revenue_inr": (total_revenue_paise - total_refunds_paise) / 100.0,
        "successful_transactions_count": successful_payments,
        "failed_orders_count": failed_orders,
        "active_subscribers": {
            "pro": active_pro,
            "business": active_business,
            "total": active_pro + active_business
        },
        "gateway_mode": RazorpayService.get_mode(),
        "is_gateway_configured": RazorpayService.is_configured()
    }


@router.get("/payments/transactions")
def list_admin_transactions(
    limit: int = 50,
    offset: int = 0,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Paginated list of all payment transactions for audit and reporting.
    """
    query = db.query(PaymentTransaction)
    if status_filter:
        query = query.filter(PaymentTransaction.status == status_filter)

    total = query.count()
    records = query.order_by(PaymentTransaction.created_at.desc()).offset(offset).limit(limit).all()

    items = []
    for t in records:
        user = db.query(User).filter(User.id == t.user_id).first()
        inv = db.query(Invoice).filter(Invoice.transaction_id == t.id).first()
        items.append({
            "id": t.id,
            "user_email": user.email if user else "Deleted User",
            "gateway_payment_id": t.gateway_payment_id,
            "amount_inr": t.amount / 100.0,
            "currency": t.currency,
            "method": t.method,
            "status": t.status,
            "card_network": t.card_network,
            "card_last4": t.card_last4,
            "vpa": t.vpa,
            "invoice_number": inv.invoice_number if inv else None,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }


@router.post("/payments/refund")
def admin_issue_refund(
    req: AdminRefundRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin command to execute a live refund via Razorpay API and update database state.
    """
    trans = db.query(PaymentTransaction).filter(PaymentTransaction.id == req.transaction_id).first()
    if not trans:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    refund_amount = req.amount_paise or trans.amount
    gateway_refund_id = None
    refund_status = "processed"

    if RazorpayService.is_configured():
        try:
            rzp_refund = RazorpayService.create_refund(
                payment_id=trans.gateway_payment_id,
                amount_paise=refund_amount,
                notes={"admin_id": admin.id, "reason": req.reason or "Admin refund"}
            )
            gateway_refund_id = rzp_refund.get("id")
        except RazorpayServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=f"Razorpay refund failed: {e.message}")
    else:
        refund_status = "pending"

    trans.status = "refunded" if refund_amount == trans.amount else "partially_refunded"

    refund = Refund(
        user_id=trans.user_id,
        transaction_id=trans.id,
        gateway_refund_id=gateway_refund_id,
        amount=refund_amount,
        currency=trans.currency,
        status=refund_status,
        reason=req.reason or "Admin issued refund",
        requested_by="admin",
        admin_notes=req.admin_notes
    )
    db.add(refund)
    db.commit()

    return {
        "success": True,
        "message": f"Refund of INR {refund_amount / 100.0:.2f} processed successfully.",
        "refund_id": refund.id,
        "gateway_refund_id": gateway_refund_id,
        "status": refund_status
    }
