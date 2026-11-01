import React from "react";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Terms of Service</h1>
      <p className="text-xs text-slate-500">Effective Date: November 2026</p>

      <section className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">1. Service Acceptance</h2>
        <p>
          By accessing or using BricDoc, you agree to comply with and be bound by these terms. If you do not agree, do not use the service.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">2. Acceptable Use</h2>
        <p>
          You agree not to upload malware, malicious executable scripts, copyrighted material without authorization, or content that violates applicable privacy and intellectual property laws.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">3. Service Limitations & Disclaimers</h2>
        <p>
          While BricDoc utilizes high-fidelity rendering engines, PDF-to-office conversions and OCR depend on source document quality. We do not warrant that all layouts or complex vector graphics will be preserved perfectly in all instances.
        </p>
      </section>
    </div>
  );
}
