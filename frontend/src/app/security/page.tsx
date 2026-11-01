import React from "react";
import { ShieldCheck, Lock, EyeOff, Key, Database, Server, RefreshCw } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-10">
      <div className="text-center max-w-2xl mx-auto">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          BricDoc Security Architecture
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Built with defense-in-depth principles. How we safeguard your confidential documents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-brand-600 font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span>Private Vault Isolation</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Every uploaded document is isolated in a private user directory with non-guessable UUID filenames.
            Path traversal validation strictly prevents directory traversal attacks, and endpoints require authenticated ownership verification.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
            <Key className="w-4 h-4" />
            <span>Standard AES-256 Encryption</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            When you protect your document with BricDoc, it is encrypted using industry-standard AES-256 algorithms.
            The password is never stored on our servers; only parties with the secret key can decrypt the file.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm">
            <EyeOff className="w-4 h-4" />
            <span>Permanent Irreversible Redaction</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Unlike superficial PDF editors that merely place a black box over text, BricDoc permanently strips
            underlying text streams, vector characters, and raster pixels, ensuring redacted data cannot be extracted by scrapers.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Server className="w-4 h-4" />
            <span>Zero AI Model Training</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Your documents are never used to train foundation models. Inferences are executed through secure APIs with zero data retention,
            and content is treated strictly as untrusted user data with prompt injection isolation.
          </p>
        </div>
      </div>
    </div>
  );
}
