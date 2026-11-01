"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TOOLS_REGISTRY, CATEGORIES } from "@/lib/tool-registry";
import {
  Layers,
  Minimize2,
  FileText,
  Lock,
  Zap,
  Sparkles,
  Search,
  ArrowRight
} from "lucide-react";

export default function ToolsCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = TOOLS_REGISTRY.filter((t) => {
    const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          All PDF & Document Tools
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Over 20 professional document manipulation, conversion, security, and AI tools.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((tool) => (
          <Link
            key={tool.id}
            href={tool.route}
            className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-500 shadow-soft-sm hover:shadow-soft-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-105 transition-transform">
                  {tool.category === "organize" && <Layers className="w-4 h-4" />}
                  {tool.category === "optimize" && <Minimize2 className="w-4 h-4" />}
                  {tool.category === "convert" && <FileText className="w-4 h-4" />}
                  {tool.category === "security" && <Lock className="w-4 h-4" />}
                  {tool.category === "ocr" && <Zap className="w-4 h-4" />}
                  {tool.category === "ai" && <Sparkles className="w-4 h-4" />}
                  {tool.category === "edit" && <FileText className="w-4 h-4" />}
                </div>
                {tool.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                    {tool.badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                {tool.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {tool.tagline}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 group-hover:text-brand-600">
              <span>Open tool</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
