"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-soft-xl">
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to login</span>
          </Link>
          <Logo size="md" />
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
            Reset your password
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your email and we will send you secure recovery instructions.
          </p>
        </div>

        {submitted ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Reset email sent
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              If an account matches {email}, a recovery link has been delivered.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
            >
              Send Instructions
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
