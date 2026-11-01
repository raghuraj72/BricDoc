"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  FolderLock,
  Upload,
  Search,
  Star,
  Trash2,
  Download,
  Share2,
  FileText,
  RefreshCw,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";

export default function MyDocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [shareResult, setShareResult] = useState<{ url: string; copied: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const data = await api.listDocuments({ search, is_trashed: false });
      setDocuments(data);
    } catch {
      // Handle guest/offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [search]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        await api.uploadDocument(e.target.files[0]);
        loadDocuments();
      } catch (err: any) {
        alert(err.message || "Failed to upload document.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleTrash = async (id: string) => {
    try {
      await api.trashDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete.");
    }
  };

  const handleShare = async (id: string) => {
    try {
      const res = await api.createShareLink(id, 48);
      const fullUrl = `${window.location.origin}${res.share_url}`;
      setShareResult({ url: fullUrl, copied: false });
    } catch (err: any) {
      alert(err.message || "Failed to generate share link.");
    }
  };

  const copyShareLink = () => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.url);
    setShareResult({ ...shareResult, copied: true });
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Document Vault
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Secure, encrypted personal document library.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.png,.jpg"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
          >
            {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Share Dialog banner */}
      {shareResult && (
        <div className="p-4 bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-900 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate w-full sm:w-auto">
            <Share2 className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="font-semibold text-brand-900 dark:text-brand-200">Share Link (valid for 48h):</span>
            <span className="font-mono text-slate-600 dark:text-slate-400 truncate">{shareResult.url}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700"
            >
              {shareResult.copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{shareResult.copied ? "Copied" : "Copy Link"}</span>
            </button>
            <button
              onClick={() => setShareResult(null)}
              className="text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by filename or tags..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
        />
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm overflow-hidden">
        {documents.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FolderLock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No documents in vault
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Upload your PDF or office documents to organize, protect, and share them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Pages</th>
                  <th className="py-3 px-4">Date Added</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                      <span className="truncate max-w-xs sm:max-w-md">{doc.filename}</span>
                    </td>
                    <td className="py-3.5 px-4">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="py-3.5 px-4">{doc.page_count}</td>
                    <td className="py-3.5 px-4">{formatDate(doc.created_at)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={`/api/v1/documents/${doc.id}/download`}
                          className="p-1.5 text-slate-500 hover:text-brand-600 rounded"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleShare(doc.id)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 rounded"
                          title="Create Share Link"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleTrash(doc.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded"
                          title="Move to Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
