"""
BricDoc Server-Authoritative Pricing Configuration & Tax Engine.
Single Source of Truth for all subscription tiers, prices, limits, and tax breakdowns.
"""

from typing import Dict, Any, Optional

# Server-Authoritative Plans
PLANS: Dict[str, Dict[str, Any]] = {
    "free": {
        "id": "plan_free",
        "tier": "free",
        "name": "Free",
        "headline": "Essential PDF tools for everyone",
        "currency": "INR",
        "price_usd": 0.0,
        "price_inr": 0.0,
        "amount_paise": 0,
        "interval": "month",
        "has_promo": False,
        "features": [
            "Up to 10 files per day",
            "Core Merge, Split & Compress",
            "PDF to Word & Image conversions",
            "AES-256 Encryption & Redactions",
            "500 MB private cloud storage"
        ],
        "limits": {
            "daily_file_limit": 10,
            "max_storage_bytes": 500 * 1024 * 1024,  # 500 MB
            "max_file_size_mb": 25,
            "ai_credits_monthly": 50,
            "team_shared_folders": False,
            "audit_logging": False,
            "priority_queue": False
        }
    },
    "pro": {
        "id": "plan_pro",
        "tier": "pro",
        "name": "Pro",
        "headline": "For students, researchers, and professional creators",
        "currency": "INR",
        "price_usd": 12.0,
        "price_inr": 999.0,
        "amount_paise": 99900,  # ₹999.00 / month
        "has_promo": True,
        "promo_price_usd": 1.0,
        "promo_price_inr": 85.0,
        "promo_amount_paise": 8500,  # ₹85.00 for first month
        "interval": "month",
        "features": [
            "Unlimited files per day",
            "Everything in Free, plus:",
            "AI PDF Summaries & Grounded Q&A",
            "Custom sequential multi-step workflows",
            "10 GB private vault storage (2 GB max file size)",
            "Expiring secure share links",
            "Full PDF editor and high-accuracy OCR"
        ],
        "limits": {
            "daily_file_limit": None,  # Unlimited
            "max_storage_bytes": 10 * 1024 * 1024 * 1024,  # 10 GB
            "max_file_size_mb": 2048,
            "ai_credits_monthly": 500,
            "team_shared_folders": False,
            "audit_logging": False,
            "priority_queue": True
        }
    },
    "business": {
        "id": "plan_business",
        "tier": "business",
        "name": "Business",
        "headline": "For legal teams, departments, and enterprise organizations",
        "currency": "INR",
        "price_usd": 39.0,
        "price_inr": 3299.0,
        "amount_paise": 329900,  # ₹3,299.00 / month
        "has_promo": False,
        "interval": "month",
        "features": [
            "Unlimited files per day",
            "Everything in Pro, plus:",
            "Team shared vault folders & granular permissions",
            "Comprehensive audit logging & compliance trails",
            "100 GB private vault storage",
            "Priority processing queue with dedicated workers",
            "24/7 Priority SLA support"
        ],
        "limits": {
            "daily_file_limit": None,  # Unlimited
            "max_storage_bytes": 100 * 1024 * 1024 * 1024,  # 100 GB
            "max_file_size_mb": 2048,
            "ai_credits_monthly": 2000,
            "team_shared_folders": True,
            "audit_logging": True,
            "priority_queue": True
        }
    }
}


class PricingEngine:
    """
    Authoritative server engine for computing payable amounts,
    validating eligibility, and calculating transparent tax breakdowns.
    """

    @staticmethod
    def get_plan(plan_tier: str) -> Dict[str, Any]:
        normalized = (plan_tier or "free").lower().strip()
        if normalized not in PLANS:
            raise ValueError(f"Invalid plan tier: '{plan_tier}'. Supported: {list(PLANS.keys())}")
        return PLANS[normalized]

    @staticmethod
    def calculate_order(
        plan_tier: str,
        first_time_offer_eligible: bool = False,
        tax_rate_percent: float = 18.0
    ) -> Dict[str, Any]:
        """
        Computes exact payable amount in paise with tax breakdown.
        Never relies on client input.
        """
        plan = PricingEngine.get_plan(plan_tier)
        tier = plan["tier"]

        if tier == "free":
            return {
                "plan_tier": "free",
                "plan_name": plan["name"],
                "currency": "INR",
                "is_promo": False,
                "amount_paise": 0,
                "amount_inr": 0.0,
                "subtotal_paise": 0,
                "tax_paise": 0,
                "cgst_paise": 0,
                "sgst_paise": 0,
                "tax_rate_percent": tax_rate_percent,
                "display_price": "₹0",
                "next_renewal_paise": 0
            }

        is_promo = False
        amount_paise = plan["amount_paise"]

        if tier == "pro" and first_time_offer_eligible and plan.get("has_promo"):
            is_promo = True
            amount_paise = plan["promo_amount_paise"]

        # Calculate inclusive 18% GST breakdown (standard Indian SaaS consumer billing)
        # Total Amount = Subtotal * (1 + tax_rate/100)
        # Subtotal = Total / (1 + tax_rate/100)
        tax_multiplier = 1.0 + (tax_rate_percent / 100.0)
        subtotal_paise = int(round(amount_paise / tax_multiplier))
        tax_paise = amount_paise - subtotal_paise
        cgst_paise = tax_paise // 2
        sgst_paise = tax_paise - cgst_paise

        next_renewal_paise = plan["amount_paise"]

        return {
            "plan_tier": tier,
            "plan_name": plan["name"],
            "currency": plan["currency"],
            "is_promo": is_promo,
            "amount_paise": amount_paise,
            "amount_inr": round(amount_paise / 100.0, 2),
            "amount_usd_equiv": plan["promo_price_usd"] if is_promo else plan["price_usd"],
            "subtotal_paise": subtotal_paise,
            "subtotal_inr": round(subtotal_paise / 100.0, 2),
            "tax_paise": tax_paise,
            "tax_inr": round(tax_paise / 100.0, 2),
            "cgst_paise": cgst_paise,
            "cgst_inr": round(cgst_paise / 100.0, 2),
            "sgst_paise": sgst_paise,
            "sgst_inr": round(sgst_paise / 100.0, 2),
            "tax_rate_percent": tax_rate_percent,
            "display_price": f"₹{amount_paise / 100:.2f}",
            "next_renewal_paise": next_renewal_paise,
            "next_renewal_inr": round(next_renewal_paise / 100.0, 2),
            "description": f"BricDoc {plan['name']} Subscription ({'1st Month Offer: ₹85' if is_promo else f'₹{amount_paise / 100:.0f}/month'})"
        }

    @staticmethod
    def get_public_catalog(user_eligible_for_promo: bool = True) -> Dict[str, Any]:
        """Returns the public catalog suitable for rendering on frontend pricing pages."""
        catalog = {}
        for tier, plan in PLANS.items():
            order_info = PricingEngine.calculate_order(tier, first_time_offer_eligible=user_eligible_for_promo)
            catalog[tier] = {
                **plan,
                "current_pricing": order_info
            }
        return catalog
