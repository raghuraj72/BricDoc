"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Workflow,
  Plus,
  Play,
  Trash2,
  Upload,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Layers,
  Minimize2,
  Lock,
  Stamp,
  Hash
} from "lucide-react";

export default function WorkflowsPage() {
  const { isAuthenticated } = useAuth();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // New workflow state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Array<{ tool_action: string; parameters_json: string }>>([
    { tool_action: "merge", parameters_json: "{}" },
    { tool_action: "compress", parameters_json: '{"level": "recommended"}' },
  ]);

  // Run state
  const [selectedWf, setSelectedWf] = useState<any | null>(null);
  const [runFiles, setRunFiles] = useState<File[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runResultUrl, setRunResultUrl] = useState<string | null>(null);

  const loadWorkflows = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const data = await api.listWorkflows();
      setWorkflows(data);
    } catch {
      // Offline / guest
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [isAuthenticated]);

  const addStep = (action: string) => {
    setSteps([...steps, { tool_action: action, parameters_json: "{}" }]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleSaveWorkflow = async () => {
    if (!name.trim()) return;
    try {
      await api.createWorkflow({
        name,
        description,
        steps: steps.map((s, idx) => ({ ...s, order_index: idx })),
      });
      setShowBuilder(false);
      setName("");
      setDescription("");
      loadWorkflows();
    } catch (err: any) {
      alert(err.message || "Failed to save workflow.");
    }
  };

  const handleRunWorkflow = async () => {
    if (!selectedWf || runFiles.length === 0) return;
    setIsRunning(true);
    setRunResultUrl(null);
    try {
      const fd = new FormData();
      runFiles.forEach((f) => fd.append("files", f));
      const blob = await api.runWorkflow(selectedWf.id, fd);
      const url = window.URL.createObjectURL(blob);
      setRunResultUrl(url);
    } catch (err: any) {
      alert(err.message || "Workflow run failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Custom Workflows
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chain multiple PDF tasks into reusable automated pipelines.
          </p>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        )}
      </div>

      {/* Guest Notice */}
      {!isAuthenticated && (
        <div className="p-6 bg-brand-50 dark:bg-brand-950/60 rounded-2xl border border-brand-200 dark:border-brand-900 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-brand-900 dark:text-brand-200">
              Save and automate custom multi-step pipelines
            </h3>
            <p className="text-xs text-brand-700 dark:text-brand-400">
              Sign in or create a free account to build persistent workflows and run them repeatedly.
            </p>
          </div>
          <a
            href="/login"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 whitespace-nowrap"
          >
            Sign In to Build
          </a>
        </div>
      )}

      {/* Workflow Builder Dialog/Section */}
      {showBuilder && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-lg space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Create Custom Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Workflow Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Merge, Compress & Watermark"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pipeline Steps
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      {step.tool_action}
                    </span>
                  </div>
                  <button
                    onClick={() => removeStep(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-slate-400 self-center">Add Step:</span>
              {["merge", "compress", "watermark", "page_numbers", "rotate", "protect", "convert_to_docx"].map((act) => (
                <button
                  key={act}
                  onClick={() => addStep(act)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase"
                >
                  + {act.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowBuilder(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWorkflow}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
            >
              Save Workflow
            </button>
          </div>
        </div>
      )}

      {/* Preset / User Workflows List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Preset 1 */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                Preset Pipeline
              </span>
              <Workflow className="w-4 h-4 text-brand-600" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Executive Merge & Compress
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Merge multiple files, apply recommended stream compression, and stamp centered page numbers.
            </p>
          </div>
          <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 font-mono">
            <div>1. Merge PDFs</div>
            <div>2. Compress Content Streams</div>
            <div>3. Add Bottom-Center Page Numbers</div>
          </div>
        </div>

        {/* Preset 2 */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                Security Pipeline
              </span>
              <Lock className="w-4 h-4 text-violet-600" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Confidentiality Watermark & Protect
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Stamp diagonal CONFIDENTIAL watermark and encrypt document with AES-256.
            </p>
          </div>
          <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 font-mono">
            <div>1. Apply Diagonal Watermark</div>
            <div>2. Encrypt with AES-256</div>
          </div>
        </div>

        {/* User saved workflows */}
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-soft-sm flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                  Custom Saved
                </span>
                <Workflow className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{wf.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{wf.description || "Custom pipeline"}</p>
            </div>
            <div className="space-y-1 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3 font-mono">
              {wf.steps?.map((st: any, i: number) => (
                <div key={st.id}>{i + 1}. {st.tool_action.replace("_", " ")}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
