import React from "react";
import Link from "next/link";
import { Check, ShieldCheck, Zap, Sparkles, Infinity } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Core PDF tools are always free. Upgrade when you need advanced AI analysis,
          custom multi-step workflows, and expanded cloud storage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Free</h3>
              <p className="text-xs text-slate-500">Essential PDF tools for everyone</p>
              <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">$0</div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Up to 10 files per day</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Merge, Split & Compress</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>PDF to Word & Image conversions</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>AES-256 Encryption & Redactions</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>500 MB cloud vault</span>
              </li>
            </ul>
          </div>
          <Link
            href="/tools"
            className="w-full text-center py-2.5 rounded-xl font-semibold text-xs text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
          >
            Start Free
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border-2 border-brand-500 shadow-soft-lg flex flex-col justify-between space-y-6 relative">
          <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-xs font-bold bg-brand-600 text-white flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" /> Special Offer: $1 First Month
          </span>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pro</h3>
              <p className="text-xs text-slate-500">For students, researchers & pros</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">$1</span>
                <span className="text-xs font-semibold text-slate-400 line-through">$12</span>
                <span className="text-xs font-normal text-slate-500">/ 1st month (then $12/mo)</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2 font-bold text-brand-600 dark:text-brand-400">
                <Infinity className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Unlimited files per day</span>
              </li>
              <li className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Everything in Free, plus:</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>AI PDF Summaries & Grounded Q&A</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Custom sequential multi-step workflows</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>10 GB private vault storage (2 GB max file)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Expiring secure share links</span>
              </li>
            </ul>
          </div>
          <Link
            href="/signup?plan=pro&promo=dollar1"
            className="w-full text-center py-2.5 rounded-xl font-bold text-xs text-white bg-brand-600 hover:bg-brand-700 shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Claim Pro for $1</span>
          </Link>
        </div>

        {/* Business Plan */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Business</h3>
              <p className="text-xs text-slate-500">For legal teams & enterprises</p>
              <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">
                $39 <span className="text-xs font-normal text-slate-400">/ mo</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Everything in Pro, plus:</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Team shared vault folders</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Audit logging & compliance trails</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>100 GB vault storage</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Priority processing queue</span>
              </li>
            </ul>
          </div>
          <Link
            href="/contact"
            className="w-full text-center py-2.5 rounded-xl font-semibold text-xs text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
