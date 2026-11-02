"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Type,
  PenTool,
  Square,
  Highlighter,
  Eraser,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  RefreshCw,
  Undo,
  Trash2,
  FileText,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface EditItem {
  id: string;
  page: number;
  type: "text" | "rect" | "highlight" | "freehand" | "whiteout";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  strokeWidth?: number;
  points?: [number, number][];
}

export function PDFEditorCanvas() {
  const [file, setFile] = useState<File | null>(null);
  const [activeTool, setActiveTool] = useState<"text" | "freehand" | "highlight" | "rect" | "whiteout">("text");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  
  const [edits, setEdits] = useState<EditItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<[number, number][]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Tool settings
  const [textInputVal, setTextInputVal] = useState<string>("BricDoc Note");
  const [textColor, setTextColor] = useState<string>("#1e293b");
  const [textSize, setTextSize] = useState<number>(14);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);

  // Loading & status
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // References
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Helper to dynamically load Mozilla PDF.js from CDN
  const loadPdfJs = useCallback(async (): Promise<any> => {
    if (typeof window === "undefined") return null;
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          pdfjs.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(pdfjs);
        } else {
          reject(new Error("pdfjsLib not defined after CDN load"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
      document.head.appendChild(script);
    });
  }, []);

  // Handle PDF file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setEdits([]);
    setCurrentPage(1);
    setIsLoadingDoc(true);
    setStatusMessage(null);

    try {
      // 1. Try browser-native PDF.js rendering
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setStatusMessage({ type: "success", text: `Loaded document: ${selectedFile.name} (${doc.numPages} pages)` });
    } catch (err: any) {
      console.warn("PDF.js direct parse failed, falling back to server-side engine:", err);
      // Fallback: use FastAPI backend inspection
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const info = await api.getEditorInfo(formData);
        setTotalPages(info.total_pages);
        if (info.pages && info.pages[0]) {
          setPageDimensions({ width: info.pages[0].width, height: info.pages[0].height });
        }
        setStatusMessage({ type: "info", text: `Loaded via BricDoc Core Engine: ${selectedFile.name} (${info.total_pages} pages)` });
      } catch (backendErr: any) {
        setStatusMessage({ type: "error", text: backendErr.message || "Failed to load document." });
      }
    } finally {
      setIsLoadingDoc(false);
    }
  };

  // Render the current page onto bgCanvas
  const renderCurrentPage = useCallback(async () => {
    if (!file) return;
    setIsRenderingPage(true);

    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;

    // Cancel ongoing render task if any
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancellation errors
      }
    }

    try {
      // Primary: Client-side PDF.js rendering
      if (pdfDocRef.current) {
        const page = await pdfDocRef.current.getPage(currentPage);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

        // High-DPI crisp rendering
        const pixelRatio = window.devicePixelRatio || 1;
        const renderScale = zoom * pixelRatio * 1.5;
        const viewport = page.getViewport({ scale: renderScale });

        bgCanvas.width = viewport.width;
        bgCanvas.height = viewport.height;
        bgCanvas.style.width = `${unscaledViewport.width * zoom}px`;
        bgCanvas.style.height = `${unscaledViewport.height * zoom}px`;

        const ctx = bgCanvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };
          const task = page.render(renderContext);
          renderTaskRef.current = task;
          await task.promise;
        }
        return;
      }

      // Secondary Fallback: Server-side PyMuPDF rendering
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page", currentPage.toString());
      formData.append("dpi", "150");

      const res = await api.renderEditorPage(formData);
      setPageDimensions({ width: res.width, height: res.height });

      const img = new Image();
      img.onload = () => {
        bgCanvas.width = img.width;
        bgCanvas.height = img.height;
        bgCanvas.style.width = `${res.width * zoom}px`;
        bgCanvas.style.height = `${res.height * zoom}px`;

        const ctx = bgCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = res.image;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Page render error:", err);
      }
    } finally {
      setIsRenderingPage(false);
    }
  }, [file, currentPage, zoom]);

  // Trigger page render when file, page, or zoom changes
  useEffect(() => {
    if (file) {
      renderCurrentPage();
    }
  }, [file, currentPage, zoom, renderCurrentPage]);

  // Redraw annotations on the overlay canvas
  const redrawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    // Match overlay dimensions to display dimensions
    const displayWidth = pageDimensions.width * zoom;
    const displayHeight = pageDimensions.height * zoom;
    const pixelRatio = window.devicePixelRatio || 1;

    overlay.width = displayWidth * pixelRatio;
    overlay.height = displayHeight * pixelRatio;
    overlay.style.width = `${displayWidth}px`;
    overlay.style.height = `${displayHeight}px`;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Filter edits for current page
    const pageEdits = edits.filter((e) => e.page === currentPage);

    for (const edit of pageEdits) {
      const x = edit.x * zoom;
      const y = edit.y * zoom;

      if (edit.type === "text" && edit.text) {
        ctx.fillStyle = edit.color || "#0f172a";
        ctx.font = `${(edit.fontSize || 14) * zoom}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(edit.text, x, y);
      } else if (edit.type === "whiteout" && edit.width && edit.height) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, edit.width * zoom, edit.height * zoom);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, edit.width * zoom, edit.height * zoom);
      } else if (edit.type === "highlight" && edit.width && edit.height) {
        ctx.fillStyle = "rgba(254, 240, 138, 0.45)"; // Soft translucent yellow
        ctx.fillRect(x, y, edit.width * zoom, edit.height * zoom);
      } else if (edit.type === "rect" && edit.width && edit.height) {
        ctx.strokeStyle = edit.color || "#3b82f6";
        ctx.lineWidth = (edit.strokeWidth || 2) * zoom;
        ctx.strokeRect(x, y, edit.width * zoom, edit.height * zoom);
      } else if (edit.type === "freehand" && edit.points && edit.points.length > 1) {
        ctx.strokeStyle = edit.color || "#0f172a";
        ctx.lineWidth = (edit.strokeWidth || 2) * zoom;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(edit.points[0][0] * zoom, edit.points[0][1] * zoom);
        for (let i = 1; i < edit.points.length; i++) {
          ctx.lineTo(edit.points[i][0] * zoom, edit.points[i][1] * zoom);
        }
        ctx.stroke();
      }
    }

    // Draw active in-progress shape or freehand line
    if (isDrawing) {
      if (activeTool === "freehand" && currentLine.length > 1) {
        ctx.strokeStyle = textColor;
        ctx.lineWidth = strokeWidth * zoom;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(currentLine[0][0] * zoom, currentLine[0][1] * zoom);
        for (let i = 1; i < currentLine.length; i++) {
          ctx.lineTo(currentLine[i][0] * zoom, currentLine[i][1] * zoom);
        }
        ctx.stroke();
      } else if (dragStart && dragCurrent) {
        const x = Math.min(dragStart.x, dragCurrent.x) * zoom;
        const y = Math.min(dragStart.y, dragCurrent.y) * zoom;
        const w = Math.abs(dragCurrent.x - dragStart.x) * zoom;
        const h = Math.abs(dragCurrent.y - dragStart.y) * zoom;

        if (activeTool === "highlight") {
          ctx.fillStyle = "rgba(254, 240, 138, 0.45)";
          ctx.fillRect(x, y, w, h);
        } else if (activeTool === "whiteout") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        } else if (activeTool === "rect") {
          ctx.strokeStyle = textColor;
          ctx.lineWidth = strokeWidth * zoom;
          ctx.strokeRect(x, y, w, h);
        }
      }
    }
  }, [edits, currentPage, zoom, pageDimensions, isDrawing, currentLine, dragStart, dragCurrent, activeTool, textColor, strokeWidth]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  // Convert mouse event coordinates to unscaled PDF points
  const getPDFCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    return {
      x: clickX / zoom,
      y: clickY / zoom,
    };
  };

  // Mouse event handlers for drawing and placing annotations
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPDFCoordinates(e);

    if (activeTool === "text") {
      const newEdit: EditItem = {
        id: `text_${Date.now()}_${Math.random()}`,
        page: currentPage,
        type: "text",
        x: coords.x,
        y: coords.y,
        text: textInputVal || "BricDoc Note",
        color: textColor,
        fontSize: textSize,
      };
      setEdits((prev) => [...prev, newEdit]);
      return;
    }

    setIsDrawing(true);
    setDragStart(coords);
    setDragCurrent(coords);

    if (activeTool === "freehand") {
      setCurrentLine([[coords.x, coords.y]]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getPDFCoordinates(e);
    setDragCurrent(coords);

    if (activeTool === "freehand") {
      setCurrentLine((prev) => [...prev, [coords.x, coords.y]]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;

    if (activeTool === "freehand" && currentLine.length > 1) {
      setEdits((prev) => [
        ...prev,
        {
          id: `line_${Date.now()}`,
          page: currentPage,
          type: "freehand",
          x: currentLine[0][0],
          y: currentLine[0][1],
          points: currentLine,
          color: textColor,
          strokeWidth: strokeWidth,
        },
      ]);
    } else if (dragStart && dragCurrent && (activeTool === "highlight" || activeTool === "rect" || activeTool === "whiteout")) {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const width = Math.abs(dragCurrent.x - dragStart.x);
      const height = Math.abs(dragCurrent.y - dragStart.y);

      if (width > 3 && height > 3) {
        setEdits((prev) => [
          ...prev,
          {
            id: `shape_${Date.now()}`,
            page: currentPage,
            type: activeTool,
            x,
            y,
            width,
            height,
            color: textColor,
            strokeWidth: strokeWidth,
          },
        ]);
      }
    }

    setIsDrawing(false);
    setCurrentLine([]);
    setDragStart(null);
    setDragCurrent(null);
  };

  // Undo the last edit on current page
  const handleUndo = () => {
    setEdits((prev) => {
      const currentIdx = prev.findLastIndex((e) => e.page === currentPage);
      if (currentIdx === -1) return prev;
      return prev.filter((_, idx) => idx !== currentIdx);
    });
  };

  // Clear all edits on the current page
  const handleClearPage = () => {
    if (confirm(`Clear all additions on Page ${currentPage}?`)) {
      setEdits((prev) => prev.filter((e) => e.page !== currentPage));
    }
  };

  // Save changes and download modified PDF
  const handleSaveEdits = async () => {
    if (!file) return;
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("edits_json", JSON.stringify(edits));

      const blob = await api.executeTool("/editor/save-edits", formData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bricdoc_edited_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatusMessage({ type: "success", text: "Edited document downloaded successfully with all vector changes applied." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save edits to PDF." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
      {!file ? (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 sm:p-14 text-center shadow-soft-lg">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 shadow-inner">
            <FileText className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Interactive PDF Document Editor
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Add notes, sign pages, highlight passages, redact sensitive details, and draw directly over your PDF with zero loss of quality.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-8 rounded-xl font-semibold text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="w-4 h-4" />
              <span>Choose PDF File</span>
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Supports multi-page documents, forms, research papers, notes, and scanned books.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : statusMessage.type === "error"
                  ? "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  : "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-soft-md flex flex-wrap items-center justify-between gap-3">
            {/* Tool Selection Group */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTool("text")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "text"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Text</span>
              </button>

              <button
                onClick={() => setActiveTool("freehand")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "freehand"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>Draw / Sign</span>
              </button>

              <button
                onClick={() => setActiveTool("highlight")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "highlight"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Highlighter className="w-4 h-4 text-amber-500" />
                <span>Highlight</span>
              </button>

              <button
                onClick={() => setActiveTool("rect")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "rect"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Box</span>
              </button>

              <button
                onClick={() => setActiveTool("whiteout")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "whiteout"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Redact or whiteout sensitive text"
              >
                <Eraser className="w-4 h-4" />
                <span>Whiteout</span>
              </button>

              {/* Contextual Properties */}
              {activeTool === "text" && (
                <div className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    value={textInputVal}
                    onChange={(e) => setTextInputVal(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-28 sm:w-44 focus:ring-1 focus:ring-brand-500 outline-none"
                    placeholder="Click page to place note"
                  />
                  <select
                    value={textSize}
                    onChange={(e) => setTextSize(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={10}>10pt</option>
                    <option value={12}>12pt</option>
                    <option value={14}>14pt</option>
                    <option value={18}>18pt</option>
                    <option value={24}>24pt</option>
                    <option value={32}>32pt</option>
                  </select>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-6 h-6 rounded-md border-0 p-0 cursor-pointer"
                    title="Font Color"
                  />
                </div>
              )}

              {(activeTool === "freehand" || activeTool === "rect") && (
                <div className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Color:</span>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-6 h-6 rounded-md border-0 p-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 ml-1">Size:</span>
                  <select
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={1}>1px</option>
                    <option value={2}>2px</option>
                    <option value={4}>4px</option>
                    <option value={6}>6px</option>
                  </select>
                </div>
              )}
            </div>

            {/* Pagination & Zoom Controls */}
            <div className="flex items-center gap-3">
              {/* Page Navigator */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                <button
                  disabled={currentPage <= 1 || isRenderingPage}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 px-1">
                  <span>Page</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    className="w-10 text-center font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 outline-none"
                  />
                  <span>of {totalPages}</span>
                </div>
                <button
                  disabled={currentPage >= totalPages || isRenderingPage}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-xs">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.15).toFixed(2))))}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-xs text-slate-600 dark:text-slate-300 font-mono font-semibold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.0, parseFloat((z + 0.15).toFixed(2))))}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Edit Actions: Undo & Clear */}
              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                <button
                  onClick={handleUndo}
                  title="Undo last edit on this page"
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClearPage}
                  title="Clear all edits on current page"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveEdits}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Save PDF</span>
              </button>
            </div>
          </div>

          {/* Interactive Document Workspace */}
          <div className="relative overflow-auto p-6 sm:p-8 bg-slate-200/90 dark:bg-slate-950 rounded-3xl flex justify-center min-h-[700px] border border-slate-300 dark:border-slate-800/80 shadow-inner">
            {isRenderingPage && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md text-xs font-semibold text-slate-700 dark:text-slate-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600" />
                <span>Rendering Page {currentPage}...</span>
              </div>
            )}

            <div className="relative inline-block shadow-soft-2xl rounded-sm transition-transform duration-150">
              {/* Background PDF Page Canvas */}
              <canvas
                ref={bgCanvasRef}
                className="block bg-white shadow-soft-xl rounded-sm"
              />

              {/* Foreground Interactive Annotation Canvas */}
              <canvas
                ref={overlayCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="absolute inset-0 cursor-crosshair select-none touch-none"
              />
            </div>
          </div>

          {/* Footer Info Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 px-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{file.name}</span>
              <span>•</span>
              <span>{totalPages} total pages</span>
              <span>•</span>
              <span>{edits.length} annotation{edits.length === 1 ? "" : "s"} applied</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span>Tip: Click anywhere with Text tool to add notes</span>
              <span>•</span>
              <button
                onClick={() => {
                  setFile(null);
                  setEdits([]);
                }}
                className="text-brand-600 hover:underline"
              >
                Open Another PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
