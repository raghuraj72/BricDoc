"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  CreditCard,
  Receipt,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Zap,
  Sparkles,
  RotateCcw,
  XCircle,
  HardDrive
} from "lucide-react";

export default function BillingSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [subData, setSubData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Cancellation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?redirect=/settings/billing");
      return;
    }
    if (isAuthenticated) {
      loadBillingData();
    }
  }, [isLoading, isAuthenticated, router]);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const [currentSub, invRes, txRes] = await Promise.all([
        api.getCurrentSubscription(),
        api.getInvoices().catch(() => ({ invoices: [] })),
        api.getPaymentHistory().catch(() => ({ transactions: [] })),
      ]);
      setSubData(currentSub);
      setInvoices(invRes.invoices || []);
      setTransactions(txRes.transactions || []);
    } catch (err: any) {
      console.warn("Could not load billing details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await api.cancelSubscription({ cancel_at_period_end: true });
      setMessage({ type: "success", text: res.message });
      setShowCancelModal(false);
      await loadBillingData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to cancel subscription." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await api.reactivateSubscription();
      setMessage({ type: "success", text: res.message });
      await loadBillingData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to reactivate subscription." });
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
          <span>Loading billing & subscription...</span>
        </div>
      </div>
    );
  }

  const sub = subData?.subscription || {};
  const isPaidTier = sub.plan_tier === "pro" || sub.plan_tier === "business";

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Billing & Subscriptions
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your plan, review tax invoices, payment history, and auto-renewal settings.
        </p>
      </div>

      {/* Notification Banner */}
      {message && (
        <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 shadow-sm ${
          message.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200"
            : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200"
        }`}>
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Subscription Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-soft-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Active Plan
            </span>
            <div className="flex items-center gap-2.5 mt-1">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white capitalize">
                BricDoc {sub.plan_tier || "Free"}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                sub.status === "active"
                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
              }`}>
                {sub.cancel_at_period_end ? "Cancels At Period End" : (sub.status || "active")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isPaidTier ? (
              <Link
                href="/subscription/setup-payment?plan=pro&promo=dollar1"
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Upgrade to Pro ($1 / ₹85)</span>
              </Link>
            ) : sub.plan_tier === "pro" ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/subscription/setup-payment?plan=business"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <span>Upgrade to Business</span>
                </Link>
                {sub.cancel_at_period_end ? (
                  <button
                    type="button"
                    onClick={handleReactivateSubscription}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    Reactivate Auto-Renew
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    Cancel Plan
                  </button>
                )}
              </div>
            ) : (
              sub.cancel_at_period_end ? (
                <button
                  type="button"
                  onClick={handleReactivateSubscription}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  Reactivate Auto-Renew
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Cancel Plan
                </button>
              )
            )}
          </div>
        </div>

        {/* Plan Quotas & Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <HardDrive className="w-4 h-4 text-brand-600" />
              <span>Cloud Storage Quota</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {sub.max_storage_gb ? `${sub.max_storage_gb} GB` : "500 MB"}
            </div>
            <div className="text-[11px] text-slate-400">AES-256 Vault Encrypted</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span>Next Billing Cycle</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {sub.current_period_end
                ? new Date(sub.current_period_end).toLocaleDateString()
                : "Free Forever"}
            </div>
            <div className="text-[11px] text-slate-400">
              {sub.cancel_at_period_end ? "Will not renew" : "Auto-renews automatically"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>AI Credits Monthly</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {sub.ai_credits_monthly || 50} Credits
            </div>
            <div className="text-[11px] text-slate-400">Grounded Gemini PDF Summaries</div>
          </div>
        </div>
      </div>

      {/* Tax Invoices Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-soft-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand-600" />
              <span>Official Tax Invoices</span>
            </h3>
            <p className="text-xs text-slate-500">
              Compliant GST invoices with itemized tax breakdowns and transaction receipts.
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            No tax invoices generated yet. Invoices appear here automatically after verified payments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                  <th className="py-3 px-4 font-semibold">Invoice Number</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Plan</th>
                  <th className="py-3 px-4 font-semibold">Total Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(inv.issued_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-slate-700 dark:text-slate-300">
                      {inv.plan_tier}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{inv.amount_total_inr.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={inv.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Transactions History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-soft-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-600" />
            <span>Payment History</span>
          </h3>
          <p className="text-xs text-slate-500">
            Audit history of all captured payments and refunds via Razorpay.
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            No payments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                  <th className="py-3 px-4 font-semibold">Payment ID</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Method</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {tx.payment_id}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-slate-600 dark:text-slate-400">
                      {tx.method || "card/upi"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{tx.amount_inr.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        tx.status === "captured"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Subscription?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your Pro/Business benefits will remain active until the end of your paid billing period on{" "}
                  <strong>{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "next month"}</strong>.
                  After that date, your account will return to the Free tier and you will not be charged again.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-md"
              >
                {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
