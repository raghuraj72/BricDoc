import React from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { ShieldCheck, Lock, Smartphone } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="col-span-2">
            <Logo size="md" />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
              Everything your documents need. One intelligent workspace.
              Organize, convert, edit, protect, and analyze PDF documents with production-grade precision.
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Private Vault Storage
              </span>
              <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-medium">
                <Lock className="w-4 h-4" />
                AES-256 Encrypted
              </span>
            </div>
          </div>

          {/* PDF Tools */}
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Core Tools
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/tools/merge" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Merge PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/split" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Split PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/compress" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Compress PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/pdf-to-docx" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  PDF to Word
                </Link>
              </li>
              <li>
                <Link href="/tools/editor" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Edit PDF
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-brand-600 dark:text-brand-400 font-medium">
                  View All Tools →
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Platform
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/ai-assistant" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  AI Document Assistant
                </Link>
              </li>
              <li>
                <Link href="/workflows" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Workflow Builder
                </Link>
              </li>
              <li>
                <Link href="/my-documents" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Cloud Document Vault
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Security Architecture
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Trust */}
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Legal & Trust
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                  About BricDoc
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} BricDoc Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-brand-600" />
              Android Client Ready
            </span>
            <span>REST API v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
