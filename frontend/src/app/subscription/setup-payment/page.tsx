"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  CreditCard,
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
  ExternalLink,
  Key,
  X,
  Check,
  Download,
  Building2
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function SetupPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = (searchParams.get("plan") || "pro").toLowerCase();
  const promoParam = searchParams.get("promo") || "dollar1";

  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();

  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Customer Billing Info
  const [billingName, setBillingName] = useState(user?.full_name || "");
  const [billingEmail, setBillingEmail] = useState(user?.email || "");
  const [billingAddress, setBillingAddress] = useState("India");

  // Custom Keys Modal state
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [customKeyId, setCustomKeyId] = useState("");
  const [customKeySecret, setCustomKeySecret] = useState("");
  const [customWebhookSecret, setCustomWebhookSecret] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

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

    fetchGatewayConfig();

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (!billingName && user.full_name) setBillingName(user.full_name);
      if (!billingEmail && user.email) setBillingEmail(user.email);
    }
  }, [user]);

  const fetchGatewayConfig = async () => {
    try {
      setLoadingConfig(true);
      const cfg = await api.getPaymentConfig();
      setPaymentConfig(cfg);
    } catch (err: any) {
      console.warn("Could not load gateway config:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/signup?plan=${planParam}&promo=${promoParam}`);
    }
  }, [isLoading, isAuthenticated, router, planParam, promoParam]);

  // Selected plan calculation
  const planTier = planParam === "business" ? "business" : "pro";
  const isIntroPromo = planTier === "pro" && promoParam === "dollar1";

  const proCatalog = paymentConfig?.pricing_catalog?.pro || {
    intro_price_usd: 1.0,
    intro_price_inr: 85.0,
    monthly_price_usd: 12.0,
    monthly_price_inr: 999.0,
  };

  const businessCatalog = paymentConfig?.pricing_catalog?.business || {
    monthly_price_usd: 39.0,
    monthly_price_inr: 3299.0,
  };

  const taxRate = paymentConfig?.pricing_catalog?.tax_rate_percent || 18.0;

  // Amount today calculations
  const payableInr = planTier === "business"
    ? businessCatalog.monthly_price_inr
    : (isIntroPromo ? proCatalog.intro_price_inr : proCatalog.monthly_price_inr);

  const subtotalInr = Math.round((payableInr / (1 + taxRate / 100)) * 100) / 100;
  const taxInr = Math.round((payableInr - subtotalInr) * 100) / 100;

  // Launch Authentic Razorpay Standard Checkout
  const handleLaunchPayment = async () => {
    if (!mandateConsent) {
      setError("Please check the billing authorization box to proceed.");
      return;
    }

    if (!paymentConfig?.is_configured) {
      setError("Razorpay Merchant credentials are required before launching checkout. Please connect your Razorpay Key ID and Secret below.");
      setShowKeysModal(true);
      return;
    }

    if (typeof window.Razorpay === "undefined") {
      setError("Payment gateway script is still loading. Please check your internet connection and try again.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create Authentic Server-Side Order
      const orderData = await api.createPaymentOrder({
        plan: planTier,
        currency: "INR",
        billing_name: billingName.trim() || user?.full_name || "Customer",
        billing_email: billingEmail.trim() || user?.email || ""
      });

      if (!orderData || !orderData.order_id) {
        throw new Error("Could not initialize payment order from Razorpay.");
      }

      // 2. Configure Official Razorpay Standard Checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BricDoc Workspace",
        description: `BricDoc ${planTier.toUpperCase()} Membership`,
        order_id: orderData.order_id,
        prefill: {
          name: billingName || user?.full_name || "BricDoc Member",
          email: billingEmail || user?.email || "",
        },
        notes: {
          plan_tier: planTier,
          user_id: user?.id
        },
        theme: {
          color: "#4f46e5"
        },
        handler: async function (response: any) {
          // Cryptographic server-side verification
          setVerifying(true);
          try {
            const verifyRes = await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              billing_name: billingName,
              billing_email: billingEmail,
              billing_address: billingAddress
            });

            if (verifyRes.success) {
              setPaymentSuccess(verifyRes);
              await refreshUser();
              setTimeout(() => router.push("/dashboard"), 3500);
            } else {
              setError(verifyRes.message || "Payment verification failed.");
            }
          } catch (err: any) {
            setError(err.message || "Cryptographic HMAC-SHA256 signature verification failed.");
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            setError("Payment window closed without completing payment. Your account has not been charged.");
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", function (failRes: any) {
        setSubmitting(false);
        const errDesc = failRes?.error?.description || "Payment failed at issuing bank.";
        setError(`Payment failed: ${errDesc}`);
      });

      rzpInstance.open();

    } catch (err: any) {
      setError(err.message || "Failed to initiate payment gateway.");
      setSubmitting(false);
    }
  };

  // Connect Custom Merchant Keys
  const handleSaveCustomKeys = async () => {
    if (!customKeyId.trim() || !customKeySecret.trim()) {
      setKeySaveMessage("Both Key ID and Key Secret are required.");
      return;
    }

    setSavingKeys(true);
    setKeySaveMessage(null);
    try {
      const res = await api.setPaymentKeys({
        razorpay_key_id: customKeyId.trim(),
        razorpay_key_secret: customKeySecret.trim(),
        razorpay_webhook_secret: customWebhookSecret.trim() || undefined,
      });
      setKeySaveMessage(res.message);
      await fetchGatewayConfig();
      setTimeout(() => {
        setShowKeysModal(false);
        setKeySaveMessage(null);
      }, 1500);
    } catch (err: any) {
      setKeySaveMessage(err.message || "Failed to validate Razorpay keys with Razorpay API.");
    } finally {
      setSavingKeys(false);
    }
  };

  if (isLoading || loadingConfig) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
          <span>Connecting to payment infrastructure...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 fill-current" />
          <span>PRODUCTION-GRADE RAZORPAY GATEWAY</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Activate BricDoc {planTier.toUpperCase()}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Real money checkout powered by Razorpay. All transactions are cryptographically verified and backed by tax invoices.
        </p>
      </div>

      {/* Gateway Status Banner */}
      {!paymentConfig?.is_configured ? (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Merchant Setup Required: </span>
              <span>Connect your Razorpay Key ID & Key Secret to start receiving real payments in your bank account.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowKeysModal(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Connect Razorpay Keys</span>
          </button>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Razorpay Gateway Active ({paymentConfig.mode === "live" ? "Live Production Mode" : "Test Mode"}) — Key ID: <code className="font-mono">{paymentConfig.razorpay_key_id}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeysModal(true)}
            className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
          >
            <span>Change Keys</span>
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 max-w-2xl mx-auto shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <span className="font-bold">Checkout Notice: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Verifying Overlay */}
      {verifying && (
        <div className="p-6 bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 rounded-3xl text-center space-y-3 max-w-md mx-auto shadow-soft-md">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Verifying Cryptographic Payment Signature...
          </h3>
          <p className="text-xs text-slate-500">
            Communicating with Razorpay servers and generating official tax invoice.
          </p>
        </div>
      )}

      {/* Success State */}
      {paymentSuccess && (
        <div className="p-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-3xl text-center space-y-4 max-w-xl mx-auto shadow-soft-lg animate-in fade-in">
          <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Payment Verified & Subscription Active!
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {paymentSuccess.message}
          </p>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1 text-left">
            <div><strong>Payment ID:</strong> {paymentSuccess.payment_id}</div>
            <div><strong>Order ID:</strong> {paymentSuccess.order_id}</div>
            {paymentSuccess.invoice_number && (
              <div><strong>Invoice Number:</strong> {paymentSuccess.invoice_number}</div>
            )}
            <div><strong>Valid Through:</strong> {new Date(paymentSuccess.current_period_end).toLocaleDateString()}</div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {paymentSuccess.invoice_id && (
              <a
                href={`/api/v1/payments/invoices/${paymentSuccess.invoice_id}/download`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Invoice PDF</span>
              </a>
            )}
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {!paymentSuccess && !verifying && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Order Summary */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Authoritative Pricing
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                BricDoc {planTier.toUpperCase()} Membership
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {planTier === "business"
                  ? "100 GB vault, team shared folders & priority processing."
                  : "Unlimited files, 10 GB cloud vault & grounded AI assistant."}
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Subtotal (Net)</span>
                <span className="font-mono text-slate-900 dark:text-white">₹{subtotalInr.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">GST ({taxRate}% CGST + SGST)</span>
                <span className="font-mono text-slate-900 dark:text-white">₹{taxInr.toFixed(2)}</span>
              </div>
              {isIntroPromo && (
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-emerald-600 dark:text-emerald-400">First-Time Discount</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Applied ($11 off)</span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">Total Amount Due</div>
                  <div className="text-[10px] text-slate-400">
                    {isIntroPromo ? "Introductory Month" : "Monthly Billing"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
                    ₹{payableInr.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    (Approx. ${planTier === "business" ? "39.00" : (isIntroPromo ? "1.00" : "12.00")} USD)
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                <span>Renewal & Cancellation Terms</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {planTier === "business"
                  ? "Renews monthly at ₹3,299/mo ($39/mo). Can be cancelled at any time from your Billing Settings."
                  : "First month introductory rate is ₹85.00 ($1.00 USD). Subsequent monthly renewals are ₹999.00/mo ($12.00 USD)."}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>No lock-in. Cancel in 1 click anytime in Billing Settings.</span>
              </div>
            </div>
          </div>

          {/* Checkout Action Panel */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Customer & Billing Information
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                These details will appear on your generated GST Tax Invoice.
              </p>
            </div>

            {/* Billing Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name / Business Name
                </label>
                <input
                  type="text"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="e.g. Raghuraj Pratap Singh"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billing Address / Country
                </label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="City, State, Country"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Supported Payment Methods Badge */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Payment Methods Supported via Razorpay:
              </span>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 dark:text-slate-400">
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                  UPI (GPay, PhonePe, Paytm, BHIM)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                  Dynamic UPI QR Code
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                  Debit Cards & Credit Cards
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                  50+ NetBanking Banks
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                  Wallets (Mobikwik, etc.)
                </span>
              </div>
            </div>

            {/* Mandate Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={mandateConsent}
                  onChange={(e) => setMandateConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  I authorize BricDoc to charge ₹{payableInr.toFixed(2)} today for my BricDoc {planTier.toUpperCase()} membership and agree to the Terms of Service and Privacy Policy.
                </span>
              </label>
            </div>

            {/* Launch Checkout Button */}
            <button
              type="button"
              onClick={handleLaunchPayment}
              disabled={submitting || !mandateConsent}
              className="w-full py-3.5 px-6 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting to Razorpay...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pay ₹{payableInr.toFixed(2)} with Razorpay</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>PCI-DSS Level 1 Certified • 256-Bit SSL Encrypted Gateway</span>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Merchant Keys Setup Modal */}
      {showKeysModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-brand-600" />
                  <span>Connect Razorpay Merchant Keys</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Paste your API keys from Razorpay Dashboard to accept real money transactions into your bank account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKeysModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  value={customKeyId}
                  onChange={(e) => setCustomKeyId(e.target.value)}
                  placeholder="rzp_test_... or rzp_live_..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  value={customKeySecret}
                  onChange={(e) => setCustomKeySecret(e.target.value)}
                  placeholder="Enter Key Secret from Razorpay Dashboard"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razorpay Webhook Secret (Optional)
                </label>
                <input
                  type="password"
                  value={customWebhookSecret}
                  onChange={(e) => setCustomWebhookSecret(e.target.value)}
                  placeholder="Optional secret configured in Razorpay Webhooks"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 space-y-1">
                <div>1. Log in to <a href="https://dashboard.razorpay.com/" target="_blank" rel="noreferrer" className="text-brand-600 underline">Razorpay Dashboard</a>.</div>
                <div>2. Go to <strong>Account & Settings</strong> &rarr; <strong>API Keys</strong>.</div>
                <div>3. Click <strong>Generate Key</strong> to get your Key ID & Secret.</div>
                <div>4. Keys are securely validated with Razorpay before being saved.</div>
              </div>

              {keySaveMessage && (
                <div className={`p-3 rounded-xl text-xs ${
                  keySaveMessage.includes("Successfully")
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                }`}>
                  {keySaveMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowKeysModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomKeys}
                disabled={savingKeys || !customKeyId.trim() || !customKeySecret.trim()}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
              >
                {savingKeys ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating with Razorpay...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Validate & Save Keys</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
          <span>Loading checkout...</span>
        </div>
      </div>
    }>
      <SetupPaymentContent />
    </Suspense>
  );
}
