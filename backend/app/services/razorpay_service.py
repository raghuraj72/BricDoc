"""
Production-grade Razorpay API Client Service.
Wraps Razorpay REST API v1 for Orders, Payments, Refunds, Subscriptions, and HMAC verification.
"""

import hmac
import hashlib
import logging
from typing import Optional, Dict, Any
import httpx

from app.core.config import settings

logger = logging.getLogger("bricdoc.payments")
RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


class RazorpayServiceError(Exception):
    """Custom domain exception for Razorpay gateway errors."""
    def __init__(self, message: str, status_code: int = 400, details: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class RazorpayService:
    """Production Razorpay client wrapper with strictly authenticated operations."""

    @staticmethod
    def is_configured() -> bool:
        """Checks whether valid Razorpay credentials are configured."""
        key_id = settings.RAZORPAY_KEY_ID or ""
        key_secret = settings.RAZORPAY_KEY_SECRET or ""
        return bool(
            key_id
            and key_secret
            and not key_id.startswith("rzp_test_BricDoc")
            and len(key_id) > 10
            and len(key_secret) > 8
        )

    @staticmethod
    def get_key_id() -> Optional[str]:
        return settings.RAZORPAY_KEY_ID if RazorpayService.is_configured() else None

    @staticmethod
    def get_mode() -> str:
        key_id = settings.RAZORPAY_KEY_ID or ""
        if key_id.startswith("rzp_live_"):
            return "live"
        return "test"

    @staticmethod
    def _get_auth() -> tuple:
        if not RazorpayService.is_configured():
            raise RazorpayServiceError(
                "Razorpay API credentials are not configured on this server.",
                status_code=503
            )
        return (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)

    # -------------------------------------------------------------------------
    # Orders API
    # -------------------------------------------------------------------------
    @staticmethod
    def create_order(
        amount_paise: int,
        currency: str = "INR",
        receipt: Optional[str] = None,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Creates an authentic Razorpay Order on the Razorpay server.
        Docs: https://razorpay.com/docs/api/orders/#create-an-order
        """
        auth = RazorpayService._get_auth()
        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt or f"rcpt_{amount_paise}",
            "payment_capture": 1,  # Auto-capture payment when authorized
            "notes": notes or {}
        }

        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.post(f"{RAZORPAY_API_BASE}/orders", auth=auth, json=payload)
                if res.status_code not in (200, 201):
                    err_msg = res.json().get("error", {}).get("description", res.text)
                    logger.error(f"Razorpay order creation failed [{res.status_code}]: {err_msg}")
                    raise RazorpayServiceError(f"Razorpay order creation error: {err_msg}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            logger.error(f"Network error connecting to Razorpay: {e}")
            raise RazorpayServiceError("Could not connect to Razorpay payment gateway. Please try again.")

    @staticmethod
    def fetch_order(order_id: str) -> Dict[str, Any]:
        """Fetches order details by order_id."""
        auth = RazorpayService._get_auth()
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(f"{RAZORPAY_API_BASE}/orders/{order_id}", auth=auth)
                if res.status_code != 200:
                    raise RazorpayServiceError(f"Failed to fetch order: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Connection error: {e}")

    # -------------------------------------------------------------------------
    # Payments API
    # -------------------------------------------------------------------------
    @staticmethod
    def fetch_payment(payment_id: str) -> Dict[str, Any]:
        """
        Fetches payment details and status from Razorpay.
        Docs: https://razorpay.com/docs/api/payments/#fetch-a-payment
        """
        auth = RazorpayService._get_auth()
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(f"{RAZORPAY_API_BASE}/payments/{payment_id}", auth=auth)
                if res.status_code != 200:
                    raise RazorpayServiceError(f"Payment lookup failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Connection error: {e}")

    @staticmethod
    def capture_payment(payment_id: str, amount_paise: int, currency: str = "INR") -> Dict[str, Any]:
        """
        Manually captures an authorized payment if not auto-captured.
        Docs: https://razorpay.com/docs/api/payments/#capture-a-payment
        """
        auth = RazorpayService._get_auth()
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{RAZORPAY_API_BASE}/payments/{payment_id}/capture",
                    auth=auth,
                    json={"amount": amount_paise, "currency": currency}
                )
                if res.status_code not in (200, 201):
                    raise RazorpayServiceError(f"Capture failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Capture connection error: {e}")

    # -------------------------------------------------------------------------
    # Refunds API
    # -------------------------------------------------------------------------
    @staticmethod
    def create_refund(
        payment_id: str,
        amount_paise: Optional[int] = None,
        notes: Optional[Dict[str, str]] = None,
        receipt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Issues an authentic refund via Razorpay Refund API.
        Docs: https://razorpay.com/docs/api/refunds/#create-an-instant-refund
        """
        auth = RazorpayService._get_auth()
        payload: Dict[str, Any] = {"notes": notes or {}}
        if amount_paise is not None and amount_paise > 0:
            payload["amount"] = amount_paise
        if receipt:
            payload["receipt"] = receipt

        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.post(f"{RAZORPAY_API_BASE}/payments/{payment_id}/refund", auth=auth, json=payload)
                if res.status_code not in (200, 201):
                    err_msg = res.json().get("error", {}).get("description", res.text)
                    logger.error(f"Razorpay refund failed: {err_msg}")
                    raise RazorpayServiceError(f"Refund failed: {err_msg}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Refund connection error: {e}")

    # -------------------------------------------------------------------------
    # Razorpay Subscriptions (Recurring Mandates)
    # -------------------------------------------------------------------------
    @staticmethod
    def create_plan(
        name: str,
        amount_paise: int,
        currency: str = "INR",
        period: str = "monthly",
        interval: int = 1
    ) -> Dict[str, Any]:
        """Creates a recurring Plan in Razorpay Subscriptions."""
        auth = RazorpayService._get_auth()
        payload = {
            "period": period,
            "interval": interval,
            "item": {
                "name": name,
                "amount": amount_paise,
                "currency": currency,
                "description": f"{name} Recurring Billing"
            }
        }
        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.post(f"{RAZORPAY_API_BASE}/plans", auth=auth, json=payload)
                if res.status_code not in (200, 201):
                    raise RazorpayServiceError(f"Plan creation failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Plan API error: {e}")

    @staticmethod
    def create_subscription(
        plan_id: str,
        total_count: int = 12,
        quantity: int = 1,
        customer_notify: int = 1,
        notes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Creates a recurring Subscription instance in Razorpay."""
        auth = RazorpayService._get_auth()
        payload = {
            "plan_id": plan_id,
            "total_count": total_count,
            "quantity": quantity,
            "customer_notify": customer_notify,
            "notes": notes or {}
        }
        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.post(f"{RAZORPAY_API_BASE}/subscriptions", auth=auth, json=payload)
                if res.status_code not in (200, 201):
                    raise RazorpayServiceError(f"Subscription creation failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Subscription API error: {e}")

    @staticmethod
    def cancel_subscription(subscription_id: str, cancel_at_cycle_end: bool = True) -> Dict[str, Any]:
        """Cancels an active Razorpay recurring subscription."""
        auth = RazorpayService._get_auth()
        payload = {"cancel_at_cycle_end": 1 if cancel_at_cycle_end else 0}
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(f"{RAZORPAY_API_BASE}/subscriptions/{subscription_id}/cancel", auth=auth, json=payload)
                if res.status_code not in (200, 201):
                    raise RazorpayServiceError(f"Cancel subscription failed: {res.text}", status_code=res.status_code)
                return res.json()
        except httpx.RequestError as e:
            raise RazorpayServiceError(f"Cancel connection error: {e}")

    # -------------------------------------------------------------------------
    # Cryptographic Signature Verification
    # -------------------------------------------------------------------------
    @staticmethod
    def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
        """
        Validates HMAC-SHA256 signature returned by Razorpay Standard Checkout:
        HMAC_SHA256(order_id + "|" + payment_id, key_secret)
        """
        secret = settings.RAZORPAY_KEY_SECRET or ""
        if not secret or not signature:
            return False

        message = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    @staticmethod
    def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
        """
        Validates HMAC-SHA256 signature from Razorpay Webhook header:
        X-Razorpay-Signature: HMAC_SHA256(raw_body, webhook_secret)
        """
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_KEY_SECRET or ""
        if not webhook_secret or not signature or not raw_body:
            return False

        expected_sig = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    @staticmethod
    def verify_subscription_signature(subscription_id: str, payment_id: str, signature: str) -> bool:
        """
        Validates Razorpay Subscription signature:
        HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)
        """
        secret = settings.RAZORPAY_KEY_SECRET or ""
        if not secret or not signature:
            return False

        message = f"{payment_id}|{subscription_id}".encode("utf-8")
        expected_sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)
