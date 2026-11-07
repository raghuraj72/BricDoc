"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/branding/Logo";
import {
  Sparkles,
  Layers,
  Moon,
  Sun,
  Menu,
  X,
  User,
  LogOut,
  FolderLock,
  ChevronDown,
  LayoutDashboard
} from "lucide-react";

export function Navbar() {
  const { user, isAuthenticated, logout, theme, toggleTheme } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Logo size="md" />

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {/* Tools Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Tools</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${toolsDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Quick dropdown menu */}
            {toolsDropdownOpen && (
              <div 
                className="absolute top-full left-0 mt-2 w-72 p-2 bg-white dark:bg-slate-900 rounded-xl shadow-soft-xl border border-slate-200 dark:border-slate-800 grid gap-1 z-50 animate-in fade-in-50 zoom-in-95"
                onMouseLeave={() => setToolsDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Popular Tools
                </div>
                <Link
                  href="/tools/merge"
                  onClick={() => setToolsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="w-2 h-2 rounded-full bg-brand-500" />
                  <div>
                    <div className="font-medium">Merge PDF</div>
                    <div className="text-xs text-slate-500">Combine multiple files</div>
                  </div>
                </Link>
                <Link
                  href="/tools/compress"
                  onClick={() => setToolsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <div className="font-medium">Compress PDF</div>
                    <div className="text-xs text-slate-500">Reduce file size</div>
                  </div>
                </Link>
                <Link
                  href="/tools/split"
                  onClick={() => setToolsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <div>
                    <div className="font-medium">Split PDF</div>
                    <div className="text-xs text-slate-500">Extract pages & ranges</div>
                  </div>
                </Link>
                <Link
                  href="/tools/editor"
                  onClick={() => setToolsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  <div>
                    <div className="font-medium">Edit PDF</div>
                    <div className="text-xs text-slate-500">Annotate & add text</div>
                  </div>
                </Link>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                  <Link
                    href="/tools"
                    onClick={() => setToolsDropdownOpen(false)}
                    className="block text-center py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    View All 20+ Tools →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/ai-assistant"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span>AI Workspace</span>
          </Link>

          <Link
            href="/workflows"
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Workflows
          </Link>

          <Link
            href="/pricing"
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Pricing
          </Link>
        </nav>

        {/* Right CTA / Controls */}
        <div className="hidden md:flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Dark Mode"
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                href="/settings/billing"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span>Billing</span>
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200 dark:border-brand-900"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <button
                onClick={logout}
                title="Log out"
                className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 active:scale-95 rounded-lg shadow-sm transition-all"
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-6 space-y-2">
          <Link
            href="/tools"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            All PDF Tools
          </Link>
          <Link
            href="/ai-assistant"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            AI Document Workspace
          </Link>
          <Link
            href="/workflows"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Custom Workflows
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Pricing
          </Link>
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            {isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center py-2.5 font-medium text-white bg-brand-600 rounded-lg"
                >
                  Go to Dashboard
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-center py-2 font-medium text-rose-600"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center py-2 font-medium text-slate-700 dark:text-slate-200"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center py-2.5 font-medium text-white bg-brand-600 rounded-lg"
                >
                  Get Started Free
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
