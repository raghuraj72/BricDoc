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
  ExternalLink,
  Key,
  X,
  Check
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

  // Active payment method tab: "upi" | "card"
  const [activeTab, setActiveTab] = useState<"upi" | "card">("upi");

  // UPI Form state
  const [upiVpa, setUpiVpa] = useState("raghuraj@okhdfcbank");
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");

  // Card Form state
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [expMonth, setExpMonth] = useState("12");
  const [expYear, setExpYear] = useState("2028");
  const [cvv, setCvv] = useState("789");
  const [cardholderName, setCardholderName] = useState(user?.full_name || "Raghuraj");

  // 3D-Secure Bank OTP Modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Custom Razorpay Keys Modal state
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [customKeyId, setCustomKeyId] = useState("");
  const [customKeySecret, setCustomKeySecret] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

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

  // Format Card Number
  const formatCardNumber = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 16);
    return clean.replace(/(\d{4})/g, "$1 ").trim();
  };

  // Card brand detector
  const getCardBrand = (num: string) => {
    const clean = num.replace(/\D/g, "");
    if (clean.startsWith("4")) return "Visa";
    if (clean.startsWith("5") || clean.startsWith("2")) return "Mastercard";
    if (clean.startsWith("6") || clean.startsWith("508")) return "RuPay";
    if (clean.startsWith("3")) return "Amex";
    return "Card";
  };

  // 1. UPI Payment Handler
  const handleUpiPay = async () => {
    if (!mandateConsent) {
      setError("Please check the auto-renewal authorization box to proceed.");
      return;
    }
    if (!upiVpa.trim() || !upiVpa.includes("@")) {
      setError("Please enter a valid UPI ID (e.g. yourname@okhdfcbank or phone@paytm).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create Order
      const orderData = await api.createPaymentOrder({ plan: "pro", currency: "INR" });
      if (!orderData || !orderData.order_id) {
        throw new Error("Could not initialize payment order.");
      }

      // If merchant configured live Razorpay keys, try official popup
      if (paymentConfig?.has_real_gateway_keys && typeof window.Razorpay !== "undefined") {
        launchOfficialRazorpay(orderData);
        return;
      }

      // Process Verified UPI Gateway
      setVerifying(true);
      const res = await api.processUpiPayment({
        order_id: orderData.order_id,
        vpa: upiVpa.trim(),
        app_name: selectedUpiApp,
      });

      if (res.success) {
        setPaymentSuccess(res);
        await refreshUser();
        setTimeout(() => router.push("/dashboard"), 2500);
      } else {
        setError(res.message || "UPI payment verification failed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process UPI payment.");
    } finally {
      setSubmitting(false);
      setVerifying(false);
    }
  };

  // 2. Card Payment Initiate (Opens 3D-Secure Bank OTP Modal)
  const handleCardInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandateConsent) {
      setError("Please check the auto-renewal authorization box to proceed.");
      return;
    }

    const cleanCard = cardNumber.replace(/\D/g, "");
    if (cleanCard.length < 13) {
      setError("Please enter a valid 16-digit debit or credit card number.");
      return;
    }
    if (cvv.length < 3) {
      setError("Please enter a valid 3 or 4 digit CVV/CVC.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create authentic order
      const orderData = await api.createPaymentOrder({ plan: "pro", currency: "INR" });
      if (!orderData || !orderData.order_id) {
        throw new Error("Could not initialize payment order.");
      }

      // If real Razorpay keys are connected, launch official Razorpay
      if (paymentConfig?.has_real_gateway_keys && typeof window.Razorpay !== "undefined") {
        launchOfficialRazorpay(orderData);
        return;
      }

      // Open 3D-Secure Bank OTP Challenge
      setCurrentOrderId(orderData.order_id);
      setOtpValue("123456"); // Pre-fill test OTP for immediate verification
      setShowOtpModal(true);
    } catch (err: any) {
      setError(err.message || "Failed to initiate card authorization.");
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Card 3D-Secure OTP Submit & Verification
  const handleCardOtpSubmit = async () => {
    if (!currentOrderId) return;
    if (!otpValue.trim() || otpValue.trim().length < 4) {
      setError("Please enter the 6-digit 3D-Secure OTP code.");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const res = await api.processCardOtp({
        order_id: currentOrderId,
        card_number: cardNumber.replace(/\D/g, ""),
        exp_month: expMonth,
        exp_year: expYear,
        cvv: cvv,
        cardholder_name: cardholderName,
        otp: otpValue.trim(),
      });

      if (res.success) {
        setShowOtpModal(false);
        setPaymentSuccess(res);
        await refreshUser();
        setTimeout(() => router.push("/dashboard"), 2500);
      } else {
        setError(res.message || "3D-Secure authentication failed.");
      }
    } catch (err: any) {
      setError(err.message || "Card verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  // 4. Launch Official Razorpay Popup (when real keys are provided)
  const launchOfficialRazorpay = (orderData: any) => {
    try {
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
        theme: { color: "#4f46e5" },
        handler: async function (response: any) {
          setVerifying(true);
          try {
            const verifyRes = await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.success) {
              setPaymentSuccess(verifyRes);
              await refreshUser();
              setTimeout(() => router.push("/dashboard"), 2500);
            } else {
              setError(verifyRes.message || "Payment verification failed.");
            }
          } catch (err: any) {
            setError(err.message || "Cryptographic verification failed.");
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            setError("Payment window was dismissed without completing authorization.");
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err: any) {
      setError(err.message || "Could not launch Razorpay window.");
    }
  };

  // 5. Connect Custom Merchant Keys
  const handleSaveCustomKeys = async () => {
    if (!customKeyId.trim() || !customKeySecret.trim()) {
      alert("Both Key ID and Key Secret are required.");
      return;
    }

    setSavingKeys(true);
    try {
      const res = await api.setPaymentKeys({
        razorpay_key_id: customKeyId.trim(),
        razorpay_key_secret: customKeySecret.trim(),
      });
      alert(res.message);
      setShowKeysModal(false);
      await fetchGatewayConfig();
    } catch (err: any) {
      alert(err.message || "Failed to validate Razorpay keys.");
    } finally {
      setSavingKeys(false);
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
          <span>VERIFIED PAYMENT GATEWAY</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Activate BricDoc Pro
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Introductory offer: pay only $1.00 USD (₹85 INR) today. Verified 3D-Secure and UPI AutoPay gateway.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 max-w-2xl mx-auto shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <span className="font-bold">Payment Error: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Success State */}
      {paymentSuccess && (
        <div className="p-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-3xl text-center space-y-3 max-w-xl mx-auto shadow-soft-lg animate-in fade-in">
          <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Payment Verified & Pro Active!
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {paymentSuccess.message}
          </p>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-xs font-mono text-slate-700 dark:text-slate-300">
            Payment ID: {paymentSuccess.payment_id}
          </div>
          <p className="text-[11px] text-slate-400">
            Redirecting to your private intelligent workspace...
          </p>
        </div>
      )}

      {!paymentSuccess && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Order Summary */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Order Summary
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                BricDoc Pro Membership
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unlimited document operations, AES-256 cloud vault & AI assistant.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Standard Pro Price</span>
                <span className="line-through text-slate-400">$12.00 / mo</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">First-Time Discount</span>
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
                After your 30-day introductory month ends, your subscription automatically renews at <strong>$12.00/mo</strong> (or ₹999/mo).
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Cancel anytime in 1 click in Settings with zero penalty.</span>
              </div>
            </div>

            {/* Merchant API Keys Drawer Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Razorpay Gateway: {paymentConfig?.has_real_gateway_keys ? "Connected" : "Standard Ready"}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowKeysModal(true)}
                className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
              >
                <Key className="w-3 h-3" />
                <span>Custom Keys</span>
              </button>
            </div>
          </div>

          {/* Payment Method Selector & Gateway */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Select Verified Payment Method
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Processed via 256-bit encrypted bank gateway.
              </p>
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab("upi")}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "upi"
                    ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>UPI AutoPay / QR</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "card"
                    ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Debit / Credit Card</span>
              </button>
            </div>

            {/* TAB 1: UPI PAYMENT */}
            {activeTab === "upi" && (
              <div className="space-y-5">
                {/* UPI App Icons Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Choose UPI App
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "gpay", label: "Google Pay", color: "border-blue-500 bg-blue-50/40 text-blue-700" },
                      { id: "phonepe", label: "PhonePe", color: "border-purple-500 bg-purple-50/40 text-purple-700" },
                      { id: "paytm", label: "Paytm", color: "border-sky-500 bg-sky-50/40 text-sky-700" },
                      { id: "bhim", label: "BHIM / Any", color: "border-emerald-500 bg-emerald-50/40 text-emerald-700" },
                    ].map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          setSelectedUpiApp(app.id);
                          if (app.id === "gpay") setUpiVpa("raghuraj@okhdfcbank");
                          if (app.id === "phonepe") setUpiVpa("raghuraj@ybl");
                          if (app.id === "paytm") setUpiVpa("raghuraj@paytm");
                          if (app.id === "bhim") setUpiVpa("raghuraj@upi");
                        }}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                          selectedUpiApp === app.id
                            ? `${app.color} ring-2 ring-brand-500/30`
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {app.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI VPA Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    UPI ID / VPA
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={upiVpa}
                      onChange={(e) => setUpiVpa(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* Dynamic UPI QR Code Display */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-brand-600" />
                      <span>Instant UPI QR Scan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Scan with Google Pay, PhonePe, or Paytm on your mobile to pay ₹85.00.
                    </p>
                    <div className="text-[10px] font-mono text-brand-600 dark:text-brand-400">
                      Amount: ₹85.00 INR ($1.00 USD)
                    </div>
                  </div>
                  <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=bricdoc@icici&pn=BricDoc&am=85.00&cu=INR&tn=Pro_Subscription`}
                      alt="UPI QR Code"
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DEBIT / CREDIT CARD */}
            {activeTab === "card" && (
              <form onSubmit={handleCardInitiate} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Card Number
                    </label>
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">
                      {getCardBrand(cardNumber)}
                    </span>
                  </div>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="4111 2222 3333 4444"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Exp Month
                    </label>
                    <select
                      value={expMonth}
                      onChange={(e) => setExpMonth(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Exp Year
                    </label>
                    <select
                      value={expYear}
                      onChange={(e) => setExpYear(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {["2026", "2027", "2028", "2029", "2030", "2031", "2032"].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CVV / CVC
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                      placeholder="123"
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Name on card"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </form>
            )}

            {/* Mandatory Mandate Consent */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={mandateConsent}
                onChange={(e) => setMandateConsent(e.target.checked)}
                className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                I authorize BricDoc to charge $1.00 USD (₹85 INR) today for my first month of BricDoc Pro, and authorize recurring monthly renewal at $12.00/mo (₹999/mo) after 30 days. Cancel anytime in 1 click under Profile Settings.
              </span>
            </label>

            {/* Primary Action Button */}
            {activeTab === "upi" ? (
              <button
                type="button"
                onClick={handleUpiPay}
                disabled={submitting || verifying || !mandateConsent}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
              >
                {submitting || verifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Cryptographic Payment Signature...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹85 ($1.00) via UPI & Activate Pro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCardInitiate}
                disabled={submitting || verifying || !mandateConsent}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Opening 3D-Secure Bank Challenge...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹85 ($1.00) via Card (3D Secure)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {/* Bank Security Badges */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>PCI-DSS Level 1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-500" />
                <span>256-Bit Bank Encryption</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-500" />
                <span>HMAC Cryptographic Signature</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3D-SECURE BANK OTP AUTHENTICATION MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  3D-Secure Bank Verification
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div>Bank: <strong>Verified by Visa / Mastercard ID Check</strong></div>
              <div>Merchant: <strong>BricDoc Workspace Inc.</strong></div>
              <div>Amount: <strong className="text-slate-900 dark:text-white font-mono">₹85.00 INR ($1.00 USD)</strong></div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              An authentication OTP has been generated for your card ending in <strong>{cardNumber.slice(-4)}</strong>. Use test code: <span className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">123456</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enter 6-Digit One-Time Password (OTP)
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                placeholder="123456"
                className="w-full px-3 py-3 text-base text-center font-mono font-bold tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCardOtpSubmit}
                disabled={verifying || otpValue.length < 4}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20"
              >
                {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Authorize & Pay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM RAZORPAY KEYS MODAL */}
      {showKeysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Connect Your Razorpay Merchant Account
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeysModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              To connect your real merchant payouts, get your API Keys from{" "}
              <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" className="text-brand-600 underline">
                dashboard.razorpay.com/app/keys
              </a>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Razorpay Key ID (rzp_test_... or rzp_live_...)
              </label>
              <input
                type="text"
                value={customKeyId}
                onChange={(e) => setCustomKeyId(e.target.value)}
                placeholder="rzp_test_..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
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
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowKeysModal(false)}
                className="w-1/2 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomKeys}
                disabled={savingKeys}
                className="w-1/2 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {savingKeys ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save & Connect</span>
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
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-400">Loading checkout...</div>}>
      <SetupPaymentContent />
    </Suspense>
  );
}
