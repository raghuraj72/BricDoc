"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Clock,
  Infinity,
  HelpCircle,
  Info,
  Smartphone,
  ExternalLink
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function SetupPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") || "pro";
  const promoParam = searchParams.get("promo") || "dollar1";

  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();

  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [mandateConsent, setMandateConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null);

  // Load Razorpay Script dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    // Fetch payment gateway configuration
    api.getPaymentConfig()
      .then((cfg) => setPaymentConfig(cfg))
      .catch((err) => console.warn("Could not load gateway config:", err))
      .finally(() => setLoadingConfig(false));

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/signup?plan=${planParam}&promo=${promoParam}`);
    }
  }, [isLoading, isAuthenticated, router, planParam, promoParam]);

  const handleLaunchPaymentGateway = async () => {
    if (!mandateConsent) {
      setError("Please check the auto-renewal authorization box to proceed.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create real payment order on backend
      const orderData = await api.createPaymentOrder({
        plan: "pro",
        currency: "INR",
      });

      if (!orderData || !orderData.order_id) {
        throw new Error("Failed to initialize payment gateway order. Please retry.");
      }

      // Check if Razorpay script is ready
      if (typeof window.Razorpay === "undefined") {
        throw new Error("Razorpay payment gateway script is still loading. Please try again in a few seconds.");
      }

      // 2. Open official Razorpay Checkout Window
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BricDoc Workspace",
        description: "BricDoc Pro First-Time Intro Offer ($1.00 / ₹85)",
        order_id: orderData.order_id,
        prefill: {
          name: user?.full_name || "BricDoc Member",
          email: user?.email || "",
        },
        notes: {
          plan: "pro",
          promo: promoParam,
          userId: user?.id,
        },
        theme: {
          color: "#4f46e5",
        },
        handler: async function (response: any) {
          // 3. Official Razorpay Success Handler -> Cryptographic Signature Verification
          setSubmitting(false);
          setVerifying(true);
          try {
            const verifyRes = await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              method: "upi", // gateway auto-captures method
            });

            if (verifyRes.success) {
              setPaymentSuccess(verifyRes);
              await refreshUser();
              setTimeout(() => {
                router.push("/dashboard");
              }, 2500);
            } else {
              setError(verifyRes.message || "Payment verification failed.");
            }
          } catch (err: any) {
            setError(err.message || "Cryptographic payment verification failed. Pro access not granted.");
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            setError("Payment checkout window was closed. Pro subscription was not charged or activated.");
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", function (response: any) {
        setSubmitting(false);
        const desc = response.error?.description || "Payment was declined by your bank or payment method.";
        setError(`Payment failed: ${desc}`);
      });
      rzpInstance.open();
    } catch (err: any) {
      setError(err.message || "Failed to launch payment gateway.");
      setSubmitting(false);
    }
  };

  if (isLoading || loadingConfig) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
          <span>Connecting to secure payment gateway...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-[11px] font-bold">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>REAL VERIFIED PAYMENT GATEWAY</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Activate BricDoc Pro
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          First-time introductory offer: pay only $1.00 USD (₹85 INR) today. Cancel anytime with 1 click in Settings.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 max-w-2xl mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <span className="font-bold">Transaction Alert: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Success State */}
      {paymentSuccess && (
        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-3xl text-center space-y-3 max-w-xl mx-auto shadow-soft-lg animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Payment Verified & Pro Active!
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {paymentSuccess.message}
          </p>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-xs font-mono text-slate-700 dark:text-slate-300">
            Payment ID: {paymentSuccess.payment_id}
          </div>
          <p className="text-[11px] text-slate-400">
            Redirecting you to your intelligent workspace dashboard...
          </p>
        </div>
      )}

      {!paymentSuccess && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Order Summary & Terms */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Order Summary
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                BricDoc Pro Membership
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Full unlimited file operations, AES-256 cloud vault & AI assistant.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Standard Pro Price</span>
                <span className="line-through text-slate-400">$12.00 / mo</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">First-Time Promo Discount</span>
                <span className="text-emerald-600 dark:text-emerald-400">-$11.00</span>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">Amount Due Today</div>
                  <div className="text-[10px] text-slate-400">Introductory Month</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-brand-600 dark:text-brand-400">$1.00 <span className="text-xs font-normal text-slate-400">/ ₹85</span></div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                <span>Subscription Auto-Renew Policy</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                After your 30-day introductory month ends, your subscription automatically renews at the regular rate of <strong>$12.00/mo</strong> (or ₹999/mo) using your verified payment method.
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Cancel anytime in 1 click in Settings with zero penalty.</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200">Pro Features Included:</div>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>Unlimited PDF processing & merges (no 10 files/day limit)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>10 GB private encrypted vault storage (up to 2 GB per file)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>Interactive PDF Editor with text redaction & inline notes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>500 monthly AI document intelligence & chat tokens</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Real Payment Gateway Launch Screen */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Verified Payment Gateway Checkout
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Payments are securely processed through Razorpay PCI-DSS Level 1 gateway.
              </p>
            </div>

            {/* Supported Payment Channels */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/50 dark:bg-brand-950/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">UPI & QR</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Google Pay, PhonePe, Paytm, BHIM, and instant UPI QR code scan.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/50 dark:bg-brand-950/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Debit / Credit Cards</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Visa, Mastercard, RuPay, Maestro & Amex with 3D Secure OTP.
                </p>
              </div>
            </div>

            {/* Account Details */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="text-slate-500">Account to be upgraded:</div>
              <div className="font-bold text-slate-900 dark:text-white">
                {user?.full_name || "BricDoc User"} ({user?.email})
              </div>
            </div>

            {/* Mandatory Mandate Consent */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={mandateConsent}
                onChange={(e) => setMandateConsent(e.target.checked)}
                className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                I authorize BricDoc to charge $1.00 USD (₹85 INR) today for my first month of BricDoc Pro, and authorize recurring monthly renewal at $12.00/mo (₹999/mo) after 30 days. I understand I can cancel auto-renewal anytime in 1 click under Profile Settings.
              </span>
            </label>

            {/* Gateway Checkout Button */}
            <button
              type="button"
              onClick={handleLaunchPaymentGateway}
              disabled={submitting || verifying || !mandateConsent}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Opening Razorpay Secure Window...</span>
                </>
              ) : verifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying HMAC Cryptographic Signature...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pay ₹85 ($1.00) & Authorize Pro via Razorpay</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Bank Security Badges */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>PCI-DSS Level 1 Certified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-500" />
                <span>256-Bit Bank Encryption</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-500" />
                <span>RBI e-Mandate Compliant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-400">Loading checkout...</div>}>
      <SetupPaymentContent />
    </Suspense>
  );
}
