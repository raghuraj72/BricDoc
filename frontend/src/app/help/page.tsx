import React from "react";
import Link from "next/link";
import { HelpCircle, FileText, Lock, Sparkles, Workflow } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Help Center</h1>
        <p className="mt-1 text-sm text-slate-500">Guides, tutorials, and frequently asked questions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <FileText className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">How to Merge Documents</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload two or more files to the Merge tool. Drag and drop file items to arrange the exact page sequence before generating the combined file.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <Lock className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">AES-256 PDF Protection</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Set an encryption password with at least 8 characters. Any standard PDF viewer (Adobe Acrobat, Preview, Chrome) will require this password to view the content.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Using the AI Workspace</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload any digital PDF to the AI Assistant. Choose between Structured Summarization, Interactive Chat with verified page citations, and Study Flashcard generation.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <Workflow className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Automating Custom Workflows</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Combine operations into a single execution step. For example, merge files, compress the stream, and apply confidentiality watermarks in one pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
