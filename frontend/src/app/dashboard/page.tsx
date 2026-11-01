"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, API_BASE } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  Layers,
  Minimize2,
  FileText,
  Sparkles,
  Upload,
  HardDrive,
  Clock,
  Star,
  Trash2,
  Download,
  Share2,
  ArrowRight,
  FolderLock
} from "lucide-react";

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await api.listDocuments({ is_trashed: false });
        setDocuments(docs);
      } catch {
        // Not logged in or offline
      } finally {
        setIsLoading(false);
      }
    }
    loadDocs();
  }, []);

  const totalBytes = documents.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0);
  const maxBytes = user?.subscription?.max_storage_bytes || 500 * 1024 * 1024;
  const storagePercent = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Greeting & Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-soft-xl">
        <div>
          <div className="text-xs uppercase tracking-wider text-brand-300 font-semibold mb-1">
            Intelligent Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name || "Document Pro"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            You have {documents.length} documents securely stored in your private vault.
          </p>
        </div>

        {/* Storage Bar Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 w-full md:w-72 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-200">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-brand-400" />
              <span>Vault Storage</span>
            </span>
            <span>{formatBytes(totalBytes)} / {formatBytes(maxBytes)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-brand-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(4, storagePercent)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 text-right">
            {storagePercent}% used ({user?.subscription?.plan_tier.toUpperCase() || "FREE"} TIER)
          </div>
        </div>
      </div>

      {/* Quick Tool Launchers */}
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/tools/merge"
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 shadow-soft-sm flex items-center gap-3 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">Merge PDF</div>
              <div className="text-[11px] text-slate-500">Combine files</div>
            </div>
          </Link>

          <Link
            href="/tools/compress"
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 shadow-soft-sm flex items-center gap-3 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
              <Minimize2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">Compress</div>
              <div className="text-[11px] text-slate-500">Reduce size</div>
            </div>
          </Link>

          <Link
            href="/tools/pdf-to-docx"
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 shadow-soft-sm flex items-center gap-3 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">To Word</div>
              <div className="text-[11px] text-slate-500">Convert DOCX</div>
            </div>
          </Link>

          <Link
            href="/ai-assistant"
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 shadow-soft-sm flex items-center gap-3 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center text-violet-600 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">AI Workspace</div>
              <div className="text-[11px] text-slate-500">Chat with PDF</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Vault Documents List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Vault Documents
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              {documents.length}
            </span>
          </div>

          <Link
            href="/my-documents"
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
          >
            <span>Open Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FolderLock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Your vault is empty
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Upload documents or process files with our tools to save them to your private library.
            </p>
            <div className="mt-4">
              <Link
                href="/my-documents"
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.slice(0, 8).map((doc) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {doc.filename}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{formatBytes(doc.file_size_bytes)}</span>
                      <span>•</span>
                      <span>{doc.page_count} pages</span>
                      <span>•</span>
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`${API_BASE}/documents/${doc.id}/download`}
                    className="p-2 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
