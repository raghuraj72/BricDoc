"use client";

import React, { useState, useRef } from "react";
import { ToolDefinition } from "@/lib/tool-registry";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  Upload,
  FileCheck,
  Download,
  AlertCircle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Settings2,
  Lock,
  ArrowRight
} from "lucide-react";

interface ToolWorkspaceProps {
  tool: ToolDefinition;
  customOptionsRenderer?: (options: any, setOptions: (opts: any) => void) => React.ReactNode;
}

export function ToolWorkspace({ tool, customOptionsRenderer }: ToolWorkspaceProps) {
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>("");
  const [resultMeta, setResultMeta] = useState<{ origSize?: number; newSize?: number; reduction?: string } | null>(null);
  const [jsonReport, setJsonReport] = useState<any>(null);

  // Common tool settings
  const [options, setOptions] = useState<Record<string, any>>({
    level: "recommended",
    angle: 90,
    ranges: "1",
    position: "bottom-center",
    password: "",
    text: "CONFIDENTIAL",
    opacity: 0.3,
    font_size: 48,
    rotation: 45,
    margin_points: 36,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      if (tool.acceptsMultiple) {
        setFiles((prev) => [...prev, ...selected]);
      } else {
        setFiles([selected[0]]);
      }
      setError(null);
      setResultBlob(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      if (tool.acceptsMultiple) {
        setFiles((prev) => [...prev, ...dropped]);
      } else {
        setFiles([dropped[0]]);
      }
      setError(null);
      setResultBlob(null);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      setError("Please select at least one file to process.");
      return;
    }

    if (tool.id === "protect" && !options.password?.trim()) {
      setError("Please enter a password to protect your document.");
      return;
    }

    if (tool.id === "unlock" && !options.password?.trim()) {
      setError("Please enter the document password to unlock it.");
      return;
    }

    if (tool.id === "watermark" && !options.text?.trim()) {
      setError("Please enter watermark text.");
      return;
    }

    if (tool.id === "compare" && files.length < 2) {
      setError("Please select at least 2 PDF documents to compare.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();

      if (tool.id === "compare") {
        formData.append("file1", files[0]);
        formData.append("file2", files[1] || files[0]);
        files.forEach((f) => formData.append("files", f));
      } else if (tool.acceptsMultiple) {
        files.forEach((f) => formData.append("files", f));
        if (files[0]) formData.append("file", files[0]);
      } else {
        formData.append("file", files[0]);
        formData.append("files", files[0]);
      }

      // Append tool-specific options
      Object.entries(options).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          formData.append(key, String(val));
        }
      });

      const responseData = await api.executeTool<any>(tool.apiEndpoint, formData);

      let processedBlob: Blob;
      if (responseData instanceof Blob) {
        processedBlob = responseData;
        setJsonReport(null);
      } else {
        const jsonStr = JSON.stringify(responseData, null, 2);
        processedBlob = new Blob([jsonStr], { type: "application/json" });
        setJsonReport(responseData);
      }
      setResultBlob(processedBlob);

      // Determine clean filename
      const baseName = files[0].name.replace(/\.[^/.]+$/, "");
      let outExt = "pdf";
      if (tool.id === "pdf-to-docx") outExt = "docx";
      if (tool.id === "pdf-to-excel") outExt = "xlsx";
      if (tool.id === "pdf-to-markdown") outExt = "md";
      if (tool.id === "split" && !options.ranges) outExt = "zip";
      if (tool.id === "pdf-to-images") outExt = "zip";
      if (tool.id === "compare" || tool.id === "inspect-ocr") outExt = "json";

      const outName = `${tool.id}_${baseName}.${outExt}`;
      setDownloadFilename(outName);

      if (tool.id === "compress" && processedBlob.size) {
        const orig = files[0].size;
        const comp = processedBlob.size;
        const red = (((orig - comp) / orig) * 100).toFixed(1);
        setResultMeta({ origSize: orig, newSize: comp, reduction: red });
      }
    } catch (err: any) {
      setError(err.message || "Failed to process document. Please check file format and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const url = window.URL.createObjectURL(resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetAll = () => {
    setFiles([]);
    setResultBlob(null);
    setJsonReport(null);
    setError(null);
    setResultMeta(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {tool.name}
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
          {tool.tagline}
        </p>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft-lg border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 transition-colors">
        {/* Upload Zone */}
        {files.length === 0 && !resultBlob && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 scale-[1.01]"
                : "border-slate-300 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={tool.acceptsMultiple}
              accept={tool.acceptedFileTypes.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Choose {tool.acceptsMultiple ? "files" : "a file"} or drag & drop here
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Supported formats: {tool.acceptedFileTypes.join(", ")} (up to 50MB)
            </p>
          </div>
        )}

        {/* Selected Files & Configuration Stage */}
        {files.length > 0 && !resultBlob && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Selected {files.length === 1 ? "Document" : `Documents (${files.length})`}
                </h3>
                <p className="text-xs text-slate-500">Ready for processing</p>
              </div>
              <button
                onClick={resetAll}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                Clear all
              </button>
            </div>

            {/* File List */}
            <div className="grid gap-3 max-h-60 overflow-y-auto pr-1">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-slate-500">{formatBytes(file.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom or Generic Options Panel */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <Settings2 className="w-4 h-4 text-brand-600" />
                <span>Tool Settings</span>
              </div>

              {/* Compression settings */}
              {tool.id === "compress" && (
                <div className="grid grid-cols-3 gap-3">
                  {["extreme", "recommended", "low"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setOptions({ ...options, level: lvl })}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        options.level === lvl
                          ? "border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="capitalize text-sm font-medium">{lvl}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {lvl === "extreme" ? "Max reduction" : lvl === "recommended" ? "Good balance" : "High quality"}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Password Protect settings */}
              {tool.id === "protect" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Set Document Password
                  </label>
                  <input
                    type="password"
                    value={options.password}
                    onChange={(e) => setOptions({ ...options, password: e.target.value })}
                    placeholder="Enter secure password"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}

              {/* Unlock PDF settings */}
              {tool.id === "unlock" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Current Document Password
                  </label>
                  <input
                    type="password"
                    value={options.password}
                    onChange={(e) => setOptions({ ...options, password: e.target.value })}
                    placeholder="Enter document password to decrypt"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}

              {/* Watermark settings */}
              {tool.id === "watermark" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Watermark Text
                    </label>
                    <input
                      type="text"
                      value={options.text}
                      onChange={(e) => setOptions({ ...options, text: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Opacity ({Math.round(options.opacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.05"
                      value={options.opacity}
                      onChange={(e) => setOptions({ ...options, opacity: parseFloat(e.target.value) })}
                      className="w-full mt-2"
                    />
                  </div>
                </div>
              )}

              {/* Rotate settings */}
              {tool.id === "rotate" && (
                <div className="flex gap-3">
                  {[90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setOptions({ ...options, angle: deg })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                        options.angle === deg
                          ? "border-brand-600 bg-brand-50 text-brand-700 font-semibold"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {deg}° Clockwise
                    </button>
                  ))}
                </div>
              )}

              {/* Page Numbers settings */}
              {tool.id === "page-numbers" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Position
                    </label>
                    <select
                      value={options.position}
                      onChange={(e) => setOptions({ ...options, position: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="bottom-center">Bottom Center</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-center">Top Center</option>
                      <option value="top-right">Top Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Starting Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={options.start_number || 1}
                      onChange={(e) => setOptions({ ...options, start_number: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Split settings */}
              {tool.id === "split" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Extract Page Ranges (e.g. &apos;1-3, 5&apos; or leave blank for all pages)
                  </label>
                  <input
                    type="text"
                    value={options.ranges}
                    onChange={(e) => setOptions({ ...options, ranges: e.target.value })}
                    placeholder="1-2, 4"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {/* Default fallback info */}
              {!["compress", "protect", "unlock", "watermark", "rotate", "page-numbers", "split"].includes(tool.id) && (
                <div className="text-xs text-slate-500">
                  Standard optimized parameters will be automatically applied to your document.
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-brand-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Processing Document...</span>
                </>
              ) : (
                <>
                  <span>Process with {tool.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Download / Result Stage */}
        {resultBlob && (
          <div className="text-center py-8 space-y-6 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {jsonReport ? "Analysis Report Complete" : "Your document is ready!"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {downloadFilename} • {formatBytes(resultBlob.size)}
              </p>
              {resultMeta && (
                <div className="mt-3 inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span>Original: {formatBytes(resultMeta.origSize || 0)}</span>
                  <span>→</span>
                  <span>New: {formatBytes(resultMeta.newSize || 0)}</span>
                  <span>({resultMeta.reduction}% saved)</span>
                </div>
              )}

              {/* JSON Analysis Report Details */}
              {jsonReport && (
                <div className="mt-6 max-w-lg mx-auto text-left p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1.5 flex items-center justify-between">
                    <span>Diagnostic Details</span>
                    <span className="font-mono text-brand-600">JSON Report</span>
                  </div>
                  <pre className="overflow-x-auto p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 font-mono text-[11px] max-h-48">
                    {JSON.stringify(jsonReport, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={handleDownload}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-5 h-5" />
                <span>Download Result</span>
              </button>
              <button
                onClick={resetAll}
                className="w-full sm:w-auto py-3.5 px-5 rounded-xl font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Process Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
