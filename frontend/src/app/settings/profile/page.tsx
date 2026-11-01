"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { User, Building, Briefcase, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [jobTitle, setJobTitle] = useState(user?.profile?.job_title || "");
  const [organization, setOrganization] = useState(user?.profile?.organization || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);
    try {
      await api.updateProfile({
        full_name: fullName,
        job_title: jobTitle,
        organization,
      });
      await refreshUser();
      setSaved(true);
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-xs text-slate-500">Manage your identity, job title, and organization details.</p>
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile changes saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Address (Read-only)
          </label>
          <input
            type="email"
            disabled
            value={user?.email || ""}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Job Title
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior Researcher"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Organization / University
          </label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="py-2.5 px-5 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
