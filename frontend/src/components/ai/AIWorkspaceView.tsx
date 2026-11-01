"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import {
  Sparkles,
  MessageSquare,
  FileText,
  ListOrdered,
  GraduationCap,
  Upload,
  RefreshCw,
  Send,
  BookOpen,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export function AIWorkspaceView() {
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"summarize" | "chat" | "extract" | "study">("summarize");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Summarize state
  const [summaryType, setSummaryType] = useState<string>("structured");
  const [summaryResult, setSummaryResult] = useState<any | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string; citations?: any[] }>>([]);

  // Extract state
  const [extractType, setExtractType] = useState<string>("key_points");
  const [extractItems, setExtractItems] = useState<string[]>([]);

  // Study state
  const [studyCards, setStudyCards] = useState<Array<{ question: string; answer: string }>>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSummaryResult(null);
      setMessages([]);
      setExtractItems([]);
      setStudyCards([]);
      setError(null);
    }
  };

  const handleSummarize = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("summary_type", summaryType);
      const res = await api.aiSummarize(fd);
      setSummaryResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate summary.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!file || !chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("message", userMsg);
      const res = await api.aiChat(fd);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer || "No response provided.",
          citations: res.citations || [],
        },
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to get AI answer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("extract_type", extractType);
      const res = await api.aiExtract(fd);
      setExtractItems(res.items || []);
    } catch (err: any) {
      setError(err.message || "Extraction failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudy = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("output_type", "flashcards");
      const res = await api.aiStudy(fd);
      if (res.cards) {
        setStudyCards(res.cards);
      } else if (res.raw_output) {
        setStudyCards([{ question: "Generated Analysis", answer: res.raw_output }]);
      }
    } catch (err: any) {
      setError(err.message || "Study generation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-900 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Grounded Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          AI Document Workspace
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Summarize, interrogate, and extract structured insights grounded directly in your PDF documents.
        </p>
      </div>

      {/* Document Picker Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-soft-sm mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {file ? file.name : "Select Document for AI Analysis"}
              </div>
              <div className="text-xs text-slate-500">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports PDF documents"}
              </div>
            </div>
          </div>
          <label className="py-2 px-4 rounded-xl text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 border border-brand-200 dark:border-brand-900 cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>{file ? "Change Document" : "Choose PDF File"}</span>
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("summarize")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "summarize"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Summarizer</span>
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "chat"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat with PDF</span>
        </button>
        <button
          onClick={() => setActiveTab("extract")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "extract"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Key Points</span>
        </button>
        <button
          onClick={() => setActiveTab("study")}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "study"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Study Cards</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Summarizer */}
      {activeTab === "summarize" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Style:</span>
            {["structured", "executive", "key_points", "bullet_points"].map((st) => (
              <button
                key={st}
                onClick={() => setSummaryType(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border ${
                  summaryType === st
                    ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}

            <button
              onClick={handleSummarize}
              disabled={!file || isLoading}
              className="ml-auto py-2 px-5 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate Summary</span>
            </button>
          </div>

          {summaryResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-soft-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-600" />
                  <span>Document Summary</span>
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {summaryResult.provider}
                </span>
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {summaryResult.summary}
              </div>

              {summaryResult.citations && summaryResult.citations.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Verified Page References
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summaryResult.citations.map((c: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                        <span className="font-semibold text-brand-600">Page {c.page_number}:</span>{" "}
                        <span className="text-slate-600 dark:text-slate-400 italic">&ldquo;{c.snippet}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Chat with PDF */}
      {activeTab === "chat" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm flex flex-col h-[520px]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <MessageSquare className="w-10 h-10 mb-2 opacity-50 text-brand-600" />
                <p className="text-sm font-medium">Ask questions about your document.</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Answers are grounded directly in extracted page text with verifiable page citations.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-brand-600 text-white rounded-br-none"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                        {msg.citations.map((c: any, ci: number) => (
                          <div key={ci} className="mt-1">
                            <span className="font-semibold text-brand-600">Page {c.page_number}:</span> &ldquo;{c.snippet}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              disabled={!file || isLoading}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={file ? "Ask anything about this document..." : "Upload a PDF document first"}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!file || isLoading || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40 transition-colors"
            >
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Key Points */}
      {activeTab === "extract" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <select
              value={extractType}
              onChange={(e) => setExtractType(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="key_points">Key Points</option>
              <option value="action_items">Action Items</option>
              <option value="entities">Named Entities & Dates</option>
            </select>
            <button
              onClick={handleExtract}
              disabled={!file || isLoading}
              className="py-2 px-5 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Extract</span>
            </button>
          </div>

          {extractItems.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-soft-sm space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white">Extracted Insights</h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {extractItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Study Assistant */}
      {activeTab === "study" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleStudy}
              disabled={!file || isLoading}
              className="py-2 px-5 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
              <span>Generate Flashcards</span>
            </button>
          </div>

          {studyCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {studyCards.map((card, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-soft-sm space-y-2"
                >
                  <div className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                    Card #{idx + 1}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {card.question}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {card.answer}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
