"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/branding/Logo";
import { Lock, Mail, User, RefreshCw, AlertCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const promoParam = searchParams.get("promo");
  const isPromo = planParam === "pro" || promoParam === "dollar1";

  const { user, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (isPromo) {
        router.push("/subscription/setup-payment?plan=pro&promo=dollar1");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, isPromo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        plan: isPromo ? "pro" : "free",
        promo_code: isPromo ? "dollar1" : undefined,
      });
      if (isPromo) {
        router.push("/subscription/setup-payment?plan=pro&promo=dollar1");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-soft-xl">
      <div className="text-center">
        <Logo size="lg" className="justify-center" />
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Create your BricDoc account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {isPromo ? "Activate your $1 first-month Pro offer" : "Free forever. No credit card required."}
        </p>
      </div>

      {/* Special Offer Banner */}
      {isPromo && (
        <div className="p-3.5 bg-gradient-to-br from-brand-50 via-indigo-50 to-purple-50 dark:from-brand-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border-2 border-brand-500 rounded-2xl flex items-center gap-3 text-xs text-brand-900 dark:text-brand-200 shadow-sm">
          <Sparkles className="w-5 h-5 text-brand-600 shrink-0" />
          <div>
            <div className="font-extrabold text-brand-800 dark:text-brand-300">
              ⚡ $1 First-Month Offer Applied!
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              Enjoy unlimited file operations and Pro capabilities for just $1.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Full Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Morgan"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Password (min. 8 characters)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-xs text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : isPromo ? (
            <>
              <Zap className="w-4 h-4 fill-white" />
              <span>Claim Pro for $1 & Create Account</span>
            </>
          ) : (
            <span>Create Free Account</span>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign In
        </Link>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>AES-256 Vault Encryption • GDPR & SOC2 Type II Aligned</span>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading signup...</div>}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
