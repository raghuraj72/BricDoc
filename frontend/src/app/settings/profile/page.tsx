"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  User,
  Building,
  Briefcase,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Zap,
  AlertCircle,
  Calendar,
  Lock,
  ArrowRight
} from "lucide-react";

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [jobTitle, setJobTitle] = useState(user?.profile?.job_title || "");
  const [organization, setOrganization] = useState(user?.profile?.organization || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Subscription & Auto-Pay Mandate state
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [loadingBilling, setLoadingBilling] = useState<boolean>(true);
  const [cancellingRenew, setCancellingRenew] = useState<boolean>(false);
  const [billingFeedback, setBillingFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  const fetchBillingInfo = async () => {
    try {
      setLoadingBilling(true);
      const data = await api.getPaymentMethod();
      setBillingInfo(data);
    } catch (err: any) {
      console.warn("Could not load billing info:", err);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleCancelAutoRenew = async () => {
    if (!window.confirm("Are you sure you want to cancel auto-renewal? Your Pro benefits will continue until the end of your current billing period, and no further charges will occur.")) {
      return;
    }

    setCancellingRenew(true);
    setBillingFeedback(null);
    try {
      const res = await api.cancelAutoRenew();
      setBillingFeedback({
        type: "success",
        text: res.message || "Auto-renewal successfully cancelled. You will not be charged again.",
      });
      await fetchBillingInfo();
      await refreshUser();
    } catch (err: any) {
      setBillingFeedback({
        type: "error",
        text: err.message || "Failed to cancel auto-renewal. Please contact support.",
      });
    } finally {
      setCancellingRenew(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);
    try {
      await api.updateProfile({
        full_name: fullName,
        job_title: jobTitle,
        organization,
      });
      await refreshUser();
      setSaved(true);
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const isPro = user?.subscription?.plan_tier === "pro" || billingInfo?.subscription?.plan_tier === "pro";
  const autoRenewActive = billingInfo?.subscription?.auto_renew_enabled ?? false;
  const pm = billingInfo?.payment_method;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile & Subscription</h1>
        <p className="text-xs text-slate-500">Manage your identity, subscription tier, and auto-pay mandate controls.</p>
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile changes saved successfully.</span>
        </div>
      )}

      {/* Subscription & Auto-Renew Mandate Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPro ? "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Subscription: {isPro ? "BricDoc Pro" : "Free Plan"}
              </h2>
              <p className="text-xs text-slate-500">
                {isPro ? "Unlimited document operations & unlimited file processing." : "Limited to 10 files per day."}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${isPro ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
            {isPro ? "PRO ACTIVE" : "FREE TIER"}
          </span>
        </div>

        {billingFeedback && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${billingFeedback.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"}`}>
            {billingFeedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{billingFeedback.text}</span>
          </div>
        )}

        {loadingBilling ? (
          <div className="py-4 flex items-center justify-center text-xs text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading payment & mandate details...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {pm ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {pm.type === "upi" ? (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{pm.type === "upi" ? "UPI AutoPay (e-Mandate)" : `${pm.brand || "Debit/Credit"} Card`}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                          {pm.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {pm.type === "upi" ? pm.upi_vpa : `•••• •••• •••• ${pm.last4} (Exp: ${pm.exp_month}/${pm.exp_year})`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${autoRenewActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}>
                      {autoRenewActive ? "Auto-Renew Active" : "Auto-Renew Cancelled"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  {autoRenewActive ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Next automated charge ($12.00/mo):
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {billingInfo?.subscription?.current_period_end ? new Date(billingInfo.subscription.current_period_end).toLocaleDateString() : "Next billing cycle"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Auto-renewal is off. Your Pro plan will expire at the end of the period without any charge.
                    </div>
                  )}
                </div>

                {autoRenewActive && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCancelAutoRenew}
                      disabled={cancellingRenew}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/60 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {cancellingRenew ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      Cancel Auto-Renewal
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Unlock Unlimited Usage with First-Time $1 Offer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Link your Debit Card or UPI AutoPay mandate. Pay only $1.00 today. Cancel anytime with 1 click.
                  </p>
                </div>
                <Link
                  href="/subscription/setup-payment?plan=pro&promo=dollar1"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  <span>Claim for $1</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 flex items-center gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-Bit Encrypted Mandate</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Cancel Anytime in 1 Click</span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
          Personal Details
        </h2>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Address (Read-only)
          </label>
          <input
            type="email"
            disabled
            value={user?.email || ""}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Job Title
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior Researcher"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Organization / University
          </label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="py-2.5 px-5 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
