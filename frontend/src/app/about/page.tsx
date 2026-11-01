import React from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Logo size="lg" className="justify-center" />
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          About BricDoc
        </h1>
        <p className="text-sm text-slate-500">
          Everything your documents need. One intelligent workspace.
        </p>
      </div>

      <div className="prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
        <p>
          BricDoc was engineered to solve the fragmentation of document tools. Everyday professionals, students, researchers,
          and businesses are often forced to juggle separate sites for merging PDFs, converting to Word, compressing scans,
          and querying documents with AI.
        </p>
        <p>
          BricDoc brings all these core capabilities into one cohesive SaaS platform, built on real document processing
          engines, strict private vault storage, verifiable page citations, and zero compromise on user privacy.
        </p>
      </div>

      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 py-3 px-6 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700"
        >
          <span>Explore All Tools</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
