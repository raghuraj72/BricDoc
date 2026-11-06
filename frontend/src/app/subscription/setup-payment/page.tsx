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
  Info
} from "lucide-react";

function SetupPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") || "pro";
  const promoParam = searchParams.get("promo") || "dollar1";

  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();

  const [paymentType, setPaymentType] = useState<"upi" | "card">("upi");
  const [upiVpa, setUpiVpa] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("12");
  const [expYear, setExpYear] = useState("2028");
  const [cvv, setCvv] = useState("");
  const [cardholderName, setCardholderName] = useState(user?.full_name || "");
  const [mandateConsent, setMandateConsent] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/signup?plan=${planParam}&promo=${promoParam}`);
    }
  }, [isLoading, isAuthenticated, router, planParam, promoParam]);

  // Card brand detector
  const getCardBrand = (num: string) => {
    const clean = num.replace(/\D/g, "");
    if (clean.startsWith("4")) return "Visa";
    if (clean.startsWith("5") || clean.startsWith("2")) return "Mastercard";
    if (clean.startsWith("6") || clean.startsWith("508")) return "RuPay";
    if (clean.startsWith("3")) return "Amex";
    return "Card";
  };

  const formatCardNumber = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 16);
    return clean.replace(/(\d{4})/g, "$1 ").trim();
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandateConsent) {
      setError("Please check the auto-renewal authorization box to proceed.");
      return;
    }

    if (paymentType === "upi") {
      if (!upiVpa.trim() || !upiVpa.includes("@")) {
        setError("Please enter a valid UPI VPA (e.g. yourname@okhdfcbank or 9876543210@paytm).");
        return;
      }
    } else {
      const clean = cardNumber.replace(/\D/g, "");
      if (clean.length < 12) {
        setError("Please enter a valid card number.");
        return;
      }
      if (cvv.length < 3) {
        setError("Please enter a valid 3 or 4 digit CVV/CVC.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.setupPaymentMethod({
        payment_type: paymentType,
        upi_vpa: upiVpa.trim(),
        card_number: cardNumber.replace(/\D/g, ""),
        exp_month: expMonth,
        exp_year: expYear,
        cvv: cvv.trim(),
        cardholder_name: cardholderName.trim(),
        plan_tier: planParam,
        promo_applied: true,
      });

      if (res.success) {
        setSuccess(true);
        await refreshUser();
        setTimeout(() => {
          router.push("/dashboard");
        }, 2200);
      } else {
        setError(res.message || "Failed to set up payment mandate.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to authorize auto-debit mandate.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + 30);
  const formattedNextDate = nextBillingDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      {/* Title */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 border border-brand-300 dark:border-brand-800">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Step 2 of 2: Setup Auto-Payment Mandate</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Complete Your Pro Subscription
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Just like Netflix and Spotify, set up auto-debit via Debit Card or UPI AutoPay for automatic monthly renewal. Cancel anytime with 1 click.
        </p>
      </div>

      {success ? (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-emerald-300 dark:border-emerald-800 p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            🎉 AutoPay Mandate Authorized!
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Your introductory offer has been activated. Your daily limit is now <strong>UNLIMITED</strong> and auto-renewal is scheduled for <strong>{formattedNextDate}</strong> at $12/month.
          </p>
          <div className="pt-2 text-xs text-brand-600 font-semibold animate-pulse flex items-center justify-center gap-1.5">
            <span>Redirecting to your dashboard...</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Plan & Transparency Summary */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-soft-sm space-y-6">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Selected Plan
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                BricDoc Pro
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Unlimited document operations, 2 GB file sizes & AI Workspace.
              </p>
            </div>

            {/* Price breakdown */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">First Month Special Rate</span>
                <span className="font-bold text-slate-900 dark:text-white">$1.00</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Standard Rate (Save 92%)</span>
                <span className="line-through text-slate-400">$12.00</span>
              </div>
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Amount Due Today</div>
                  <div className="text-[11px] text-slate-400">Includes 30 days unlimited access</div>
                </div>
                <div className="text-2xl font-black text-brand-600 dark:text-brand-400">$1.00</div>
              </div>
            </div>

            {/* Auto-renew schedule explanation */}
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Next Auto-Renewal:</strong> {formattedNextDate} for $12.00/month.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Infinity className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Daily Limits:</strong> Process unlimited files starting right now.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Cancel Anytime:</strong> Turn off auto-renewal anytime in Settings before {formattedNextDate} to never be charged again.
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>PCI-DSS Level 1 Certified & RBI Mandate Compliant</span>
            </div>
          </div>

          {/* Right Column: Payment Method Tabs & Inputs */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-soft-lg space-y-6">
            {/* Payment Method Selector Tabs */}
            <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPaymentType("upi");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                  paymentType === "upi"
                    ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>UPI AutoPay (e-Mandate)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType("card");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                  paymentType === "card"
                    ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Debit / Credit Card</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuthorize} className="space-y-5">
              {paymentType === "upi" ? (
                /* UPI AutoPay Tab */
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      UPI ID / VPA for AutoPay
                    </label>
                    <div className="relative">
                      <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={upiVpa}
                        onChange={(e) => setUpiVpa(e.target.value)}
                        placeholder="yourname@okhdfcbank or 9876543210@paytm"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1.5">
                      <Info className="w-3.5 h-3.5 text-brand-600" />
                      <span>Supports Google Pay, PhonePe, Paytm, BHIM, CRED & All Bank UPI VPAs.</span>
                    </div>
                  </div>

                  {/* UPI Apps Grid */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Fast Auto-Approval:</span>
                    <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 rounded">GPay</span>
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 rounded">PhonePe</span>
                      <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-950 text-cyan-700 rounded">Paytm</span>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 rounded">BHIM</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Card Tab */
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Card Number
                      </label>
                      <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400">
                        {cardNumber ? getCardBrand(cardNumber) : "Visa / Mastercard / RuPay"}
                      </span>
                    </div>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="4532 •••• •••• 4242"
                        maxLength={19}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono tracking-wider focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Expiry Date
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={expMonth}
                          onChange={(e) => setExpMonth(e.target.value)}
                          className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                        >
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = String(i + 1).padStart(2, "0");
                            return <option key={m} value={m}>{m}</option>;
                          })}
                        </select>
                        <select
                          value={expYear}
                          onChange={(e) => setExpYear(e.target.value)}
                          className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                        >
                          {["2026", "2027", "2028", "2029", "2030", "2031", "2032"].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        CVV / CVC
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                        placeholder="123"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Name on Card
                    </label>
                    <input
                      type="text"
                      required
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder="Alex Morgan"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Mandate Authorization Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={mandateConsent}
                    onChange={(e) => setMandateConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                  <span>
                    I authorize BricDoc to verify this {paymentType === "upi" ? "UPI ID" : "card"} and register a recurring auto-debit mandate of <strong>$12.00/month</strong> starting on <strong>{formattedNextDate}</strong>. I can cancel anytime with 1 click in my account settings before the renewal date.
                  </span>
                </label>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={submitting || !mandateConsent}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authorizing AutoPay Mandate...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 fill-white" />
                    <span>Authorize Mandate & Start Pro ($1.00)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupPaymentPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto py-20 text-center text-xs text-slate-400">Loading payment setup...</div>}>
      <SetupPaymentContent />
    </Suspense>
  );
}
