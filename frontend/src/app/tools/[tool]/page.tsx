"use client";

import React, { use } from "react";
import Link from "next/link";
import { TOOLS_REGISTRY } from "@/lib/tool-registry";
import { ToolWorkspace } from "@/components/tools/ToolWorkspace";
import { PDFEditorCanvas } from "@/components/editor/PDFEditorCanvas";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function DynamicToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const resolvedParams = use(params);
  const toolSlug = resolvedParams.tool;

  if (toolSlug === "editor") {
    return (
      <div className="py-6">
        <div className="max-w-6xl mx-auto px-4 mb-4">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Tools</span>
          </Link>
        </div>
        <PDFEditorCanvas />
      </div>
    );
  }

  const tool = TOOLS_REGISTRY.find(
    (t) => t.id === toolSlug || t.route === `/tools/${toolSlug}`
  );

  if (!tool) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tool Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          The requested tool &quot;{toolSlug}&quot; is not available or has moved.
        </p>
        <div className="mt-6">
          <Link
            href="/tools"
            className="py-2.5 px-5 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700"
          >
            Browse All Tools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-4">
        <Link
          href="/tools"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Tools</span>
        </Link>
      </div>
      <ToolWorkspace tool={tool} />
    </div>
  );
}
