"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  Sparkles,
  Zap,
  Check,
  X,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Clock,
  Infinity
} from "lucide-react";

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  usedFiles?: number;
}

export function DailyLimitModal({
  isOpen,
  onClose,
  onSuccess,
  usedFiles = 10,
}: DailyLimitModalProps) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);

  if (!isOpen) return null;

  const handleClaimOffer = async () => {
    if (!user) {
      // Guest user: send to signup with pre-applied $1 promo
      onClose();
      router.push("/signup?plan=pro&promo=dollar1");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.claimFirstTimeOffer();
      if (res.success) {
        setUpgraded(true);
        await refreshUser();
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1800);
      } else if (res.requires_auth) {
        onClose();
        router.push(res.redirect_url || "/signup?plan=pro&promo=dollar1");
      } else {
        setError(res.message || "Failed to activate offer.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to activate introductory offer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all">
        {/* Top Gradient Accent */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-brand-500 to-indigo-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {upgraded ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                🎉 Welcome to BricDoc Pro!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your $1 introductory month is now active. Daily limits have been lifted — enjoy unlimited document processing!
              </p>
            </div>
          ) : (
            <>
              {/* Header Badge */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Free Daily Quota Reached ({usedFiles}/10 Files)</span>
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Unlock Unlimited Files with Pro
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Free accounts can process up to 10 files per day. Upgrade today to continue processing your documents with zero limits.
                </p>
              </div>

              {/* Special $1 First-Time Offer Box */}
              <div className="relative rounded-2xl bg-gradient-to-br from-brand-50 via-indigo-50 to-purple-50 dark:from-brand-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border-2 border-brand-500/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide bg-brand-600 text-white shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Special 1st-Time Offer
                  </span>
                  <span className="text-xs font-bold text-brand-700 dark:text-brand-300">
                    Save 92%
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-black text-slate-900 dark:text-white">
                    $1.00
                  </div>
                  <div className="text-sm line-through text-slate-400 font-medium">
                    $12.00
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    for your 1st month
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Try BricDoc Pro for just $1. After your first month, renewals are $12/month. Cancel anytime with 1 click.
                </p>

                <div className="pt-2 border-t border-brand-200/60 dark:border-brand-900/60 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Infinity className="w-4 h-4 text-brand-600 shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-white">Unlimited files per day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Up to 2 GB max file sizes (vs 25 MB on Free)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Priority high-speed OCR & document conversions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Full AI Workspace & Document Summaries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>10 GB Secure Cloud Document Vault</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleClaimOffer}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activating $1 Offer...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-white" />
                      <span>Claim Pro for $1</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
                  <Link
                    href="/pricing"
                    onClick={onClose}
                    className="hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
                  >
                    Compare all plans
                  </Link>
                  <button
                    onClick={onClose}
                    className="hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Maybe tomorrow
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
