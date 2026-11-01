"use client";

import React, { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Type,
  PenTool,
  Square,
  Highlighter,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  RefreshCw,
  Undo
} from "lucide-react";

interface EditItem {
  page: number;
  type: "text" | "rect" | "highlight" | "freehand";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  points?: [number, number][];
}

export function PDFEditorCanvas() {
  const [file, setFile] = useState<File | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "text" | "rect" | "freehand">("text");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [edits, setEdits] = useState<EditItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<[number, number][]>([]);
  const [textInputVal, setTextInputVal] = useState<string>("BricDoc Note");
  const [textColor, setTextColor] = useState<string>("#1e293b");
  const [textSize, setTextSize] = useState<number>(14);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setEdits([]);
      setCurrentPage(1);
      setTotalPages(1); // Standard 1+ page canvas
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw document sheet background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle guide lines simulating document margins
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(36 * zoom, 36 * zoom, canvas.width - 72 * zoom, canvas.height - 72 * zoom);

    // Draw placeholder text if no external render engine
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${13 * zoom}px sans-serif`;
    ctx.fillText(`Page ${currentPage} of ${totalPages} • Interactive Canvas`, 42 * zoom, 54 * zoom);

    // Draw page edits
    const pageEdits = edits.filter((e) => e.page === currentPage);
    for (const edit of pageEdits) {
      if (edit.type === "text" && edit.x && edit.y) {
        ctx.fillStyle = edit.color || "#000";
        ctx.font = `${(edit.fontSize || 14) * zoom}px sans-serif`;
        ctx.fillText(edit.text || "", edit.x * zoom, edit.y * zoom);
      } else if (edit.type === "rect" && edit.x && edit.y && edit.width && edit.height) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2 * zoom;
        ctx.strokeRect(edit.x * zoom, edit.y * zoom, edit.width * zoom, edit.height * zoom);
      } else if (edit.type === "freehand" && edit.points && edit.points.length > 1) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2 * zoom;
        ctx.beginPath();
        ctx.moveTo(edit.points[0][0] * zoom, edit.points[0][1] * zoom);
        for (let i = 1; i < edit.points.length; i++) {
          ctx.lineTo(edit.points[i][0] * zoom, edit.points[i][1] * zoom);
        }
        ctx.stroke();
      }
    }

    // Draw in-progress line
    if (isDrawing && currentLine.length > 1) {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2 * zoom;
      ctx.beginPath();
      ctx.moveTo(currentLine[0][0] * zoom, currentLine[0][1] * zoom);
      for (let i = 1; i < currentLine.length; i++) {
        ctx.lineTo(currentLine[i][0] * zoom, currentLine[i][1] * zoom);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [file, currentPage, zoom, edits, isDrawing, currentLine]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (activeTool === "text") {
      setEdits([
        ...edits,
        {
          page: currentPage,
          type: "text",
          x,
          y,
          text: textInputVal,
          color: textColor,
          fontSize: textSize,
        },
      ]);
    } else if (activeTool === "rect") {
      setEdits([
        ...edits,
        {
          page: currentPage,
          type: "rect",
          x,
          y,
          width: 140,
          height: 60,
        },
      ]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== "freehand") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setIsDrawing(true);
    setCurrentLine([[x, y]]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== "freehand") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setCurrentLine((prev) => [...prev, [x, y]]);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentLine.length > 1) {
      setEdits([
        ...edits,
        {
          page: currentPage,
          type: "freehand",
          points: currentLine,
        },
      ]);
    }
    setIsDrawing(false);
    setCurrentLine([]);
  };

  const handleSaveEdits = async () => {
    if (!file) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("edits_json", JSON.stringify(edits));

      const blob = await api.executeTool("/editor/save-edits", formData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Failed to save edits.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Upload Banner if no file */}
      {!file ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-soft-md">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600">
            <Upload className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Open a PDF to Edit & Annotate
          </h2>
          <p className="mt-1 text-sm text-slate-500 mb-6">
            Add text, signatures, highlights, and drawings directly onto pages.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-6 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-md transition-all"
          >
            Select Document
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Editor Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-soft-sm flex flex-wrap items-center justify-between gap-3">
            {/* Tool Selection */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTool("text")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  activeTool === "text"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Text</span>
              </button>
              <button
                onClick={() => setActiveTool("freehand")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  activeTool === "freehand"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>Draw</span>
              </button>
              <button
                onClick={() => setActiveTool("rect")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  activeTool === "rect"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Shape</span>
              </button>

              {activeTool === "text" && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    value={textInputVal}
                    onChange={(e) => setTextInputVal(e.target.value)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-28 sm:w-36"
                    placeholder="Note text"
                  />
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-7 h-7 rounded border-0 p-0 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Pagination & Zoom */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500 font-mono">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {edits.length > 0 && (
                <button
                  onClick={() => setEdits((e) => e.slice(0, -1))}
                  title="Undo last edit"
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Undo className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleSaveEdits}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Save PDF</span>
              </button>
            </div>
          </div>

          {/* Canvas Sheet View */}
          <div className="overflow-auto p-4 bg-slate-200 dark:bg-slate-950/80 rounded-2xl flex justify-center min-h-[600px] border border-slate-300 dark:border-slate-800">
            <canvas
              ref={canvasRef}
              width={612 * zoom}
              height={792 * zoom}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="bg-white shadow-soft-xl rounded-sm cursor-crosshair"
            />
          </div>
        </div>
      )}
    </div>
  );
}
