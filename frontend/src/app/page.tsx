"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TOOLS_REGISTRY, CATEGORIES } from "@/lib/tool-registry";
import {
  Layers,
  Split,
  Minimize2,
  FileText,
  Lock,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
  Check,
  CheckCircle2,
  Workflow,
  Cpu,
  Database,
  Smartphone
} from "lucide-react";

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = TOOLS_REGISTRY.filter((tool) => {
    const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 lg:pt-24 pb-12 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand-400/10 dark:bg-brand-600/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 mb-6 shadow-soft-sm">
          <Sparkles className="w-3.5 h-3.5 text-brand-600" />
          <span>Production Document Productivity & AI Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
          Every document task. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
            One intelligent workspace.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          BricDoc combines full-fidelity PDF manipulation, bidirectional office conversions,
          grounded AI document analysis, and private cloud vault storage into one unified, enterprise-grade system.
        </p>

        {/* Quick Launch Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/tools/merge"
            className="py-3 px-6 rounded-xl font-semibold text-sm text-white bg-brand-600 hover:bg-brand-700 active:scale-95 shadow-md shadow-brand-500/20 flex items-center gap-2 transition-all"
          >
            <span>Merge Documents</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/tools/compress"
            className="py-3 px-6 rounded-xl font-semibold text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-soft-sm transition-all"
          >
            Compress PDF
          </Link>
          <Link
            href="/ai-assistant"
            className="py-3 px-6 rounded-xl font-semibold text-sm text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200 dark:border-violet-900 shadow-soft-sm flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Workspace</span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 pt-8 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Private User Vault Isolation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-brand-600" />
            <span>AES-256 Storage & Transport</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-violet-500" />
            <span>Real Server-Side Engines</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <span>Android Ready</span>
          </div>
        </div>
      </section>

      {/* Interactive Tool Suite Directory */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Document Tool Suite
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select any tool to process, convert, or secure your documents immediately.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 20+ tools..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.route}
              className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-500/80 dark:hover:border-brand-500 shadow-soft-sm hover:shadow-soft-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/80 border border-brand-100 dark:border-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
                    {tool.category === "organize" && <Layers className="w-5 h-5" />}
                    {tool.category === "optimize" && <Minimize2 className="w-5 h-5" />}
                    {tool.category === "convert" && <FileText className="w-5 h-5" />}
                    {tool.category === "security" && <Lock className="w-5 h-5" />}
                    {tool.category === "ocr" && <Zap className="w-5 h-5" />}
                    {tool.category === "ai" && <Sparkles className="w-5 h-5" />}
                    {tool.category === "edit" && <FileText className="w-5 h-5" />}
                  </div>
                  {tool.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {tool.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {tool.tagline}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                <span>Launch tool</span>
                <ArrowRight className="w-3.5 h-3.5 -translate-x-1 group-hover:translate-x-0 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* AI Workspace Feature Spotlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-soft-xl">
          <div className="max-w-2xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-semibold text-violet-200">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              <span>Grounded Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Chat with documents. Extract facts with verifiable page citations.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Never guess what is inside a 200-page contract, financial report, or thesis.
              BricDoc AI analyzes text chunk by chunk, grounding every answer in the exact page number where the information lives.
            </p>
            <div className="pt-2">
              <Link
                href="/ai-assistant"
                className="inline-flex items-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm bg-white text-slate-900 hover:bg-slate-100 shadow-md transition-all"
              >
                <span>Open AI Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Workflows Automation Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-xs font-semibold text-brand-600 mb-3">
              <Workflow className="w-3.5 h-3.5" />
              <span>Multi-Step Automation</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Combine multiple tasks into one-click custom workflows.
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Stop repeating the same manual sequence. Build reusable pipelines like:
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Merge documents → Compress PDF → Stamp Watermark → Download</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Extract pages → Add Page Numbers → Encrypt with Password</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Convert to DOCX → Generate Grounded Summary → Save to Vault</span>
              </li>
            </ul>
            <div className="mt-6">
              <Link
                href="/workflows"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              >
                <span>Build a workflow now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-lg space-y-3 font-mono text-xs text-slate-600 dark:text-slate-400">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-sans font-bold">
              Pipeline Execution Engine
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
              <span>Step 1: Merge 3 PDF documents</span>
              <span className="text-emerald-600 font-semibold">Done (0.4s)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
              <span>Step 2: Stream Compress (Profile: Recommended)</span>
              <span className="text-emerald-600 font-semibold">Done (-42%)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
              <span>Step 3: Add Centered Page Numbers</span>
              <span className="text-emerald-600 font-semibold">Done (12 pages)</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
              <span>Result: pipeline_complete.pdf</span>
              <span>Ready for download</span>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Pro Transparent Comparison */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Transparent, Configurable Plans
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Every core PDF tool is 100% free with no account required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Tier */}
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Free Plan</h3>
              <p className="text-xs text-slate-500 mt-1">For everyday document tasks</p>
              <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">$0</div>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Unlimited Merge, Split, Rotate & Compress</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>PDF to Word, Image & Text conversions</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Password protection & permanent redaction</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>500 MB cloud vault storage</span>
              </li>
            </ul>
            <Link
              href="/tools"
              className="block w-full text-center py-2.5 rounded-xl font-semibold text-sm text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Start Using Tools
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl border-2 border-brand-500 shadow-soft-lg space-y-6 relative">
            <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-xs font-semibold bg-brand-600 text-white">
              Power Users
            </span>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pro Workspace</h3>
              <p className="text-xs text-slate-500 mt-1">For power users & teams</p>
              <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">
                $12 <span className="text-sm font-normal text-slate-400">/ month</span>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Everything in Free, plus:</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Full AI Workspace (Summaries, Q&A, Flashcards)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Automated multi-step custom workflows</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-600 shrink-0" />
                <span>10 GB private vault & expiring share links</span>
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full text-center py-2.5 rounded-xl font-semibold text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-md transition-all"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Are my files stored publicly or shared with anyone?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              No. Documents are stored in an isolated, private vault directory under authenticated user ownership.
              Files processed anonymously without an account are cleaned up immediately after session download.
            </p>
          </div>
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Are my documents used to train AI models?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Never. Document content sent for AI summarization or Q&A is processed via secure API calls strictly in-memory
              for zero-data-retention inference, and is never used for foundation model training.
            </p>
          </div>
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Will BricDoc be available on Android?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Yes. BricDoc is built mobile-first with a dedicated Capacitor architecture ready for Google Play Store compilation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
