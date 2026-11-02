"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Type,
  PenTool,
  Square,
  Highlighter,
  Eraser,
  Search,
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
  Check,
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Move
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

interface TextBlock {
  bbox: [number, number, number, number];
  text: string;
  block_id: number;
}

export function PDFEditorCanvas() {
  const [file, setFile] = useState<File | null>(null);
  const [activeTool, setActiveTool] = useState<"text" | "freehand" | "highlight" | "rect" | "whiteout" | "edit-blocks">("text");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  
  // Annotations
  const [edits, setEdits] = useState<EditItem[]>([]);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  // Active inline text creation
  const [inlineTextInput, setInlineTextInput] = useState<{
    x: number;
    y: number;
    pdfX: number;
    pdfY: number;
    text: string;
    fontSize: number;
    color: string;
  } | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<[number, number][]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Tool settings
  const [textColor, setTextColor] = useState<string>("#1e293b");
  const [textSize, setTextSize] = useState<number>(14);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);

  // Find & Replace Modal / Panel
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findScope, setFindScope] = useState<"page" | "all">("page");
  const [replaceColor, setReplaceColor] = useState("#000000");
  const [isReplacing, setIsReplacing] = useState(false);

  // Delete Text Modal / Panel
  const [showDeleteText, setShowDeleteText] = useState(false);
  const [deleteTextVal, setDeleteTextVal] = useState("");
  const [deleteScope, setDeleteScope] = useState<"page" | "all">("page");
  const [isDeletingText, setIsDeletingText] = useState(false);

  // Text Blocks (Click-to-Edit existing document text)
  const [detectBlocks, setDetectBlocks] = useState(false);
  const [pageBlocks, setPageBlocks] = useState<TextBlock[]>([]);
  const [editingBlock, setEditingBlock] = useState<{ block: TextBlock; newText: string } | null>(null);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);

  // Status & Loading
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Canvas references
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
    setSelectedEditId(null);
    setInlineTextInput(null);
    setEditingBlock(null);
    setCurrentPage(1);
    setIsLoadingDoc(true);
    setStatusMessage(null);

    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setStatusMessage({ type: "success", text: `Loaded document: ${selectedFile.name} (${doc.numPages} pages)` });
    } catch (err: any) {
      console.warn("Client PDF.js direct parse fallback to backend:", err);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const info = await api.getEditorInfo(formData);
        setTotalPages(info.total_pages);
        if (info.pages && info.pages[0]) {
          setPageDimensions({ width: info.pages[0].width, height: info.pages[0].height });
        }
        setStatusMessage({ type: "info", text: `Loaded via BricDoc Engine: ${selectedFile.name} (${info.total_pages} pages)` });
      } catch (backendErr: any) {
        setStatusMessage({ type: "error", text: backendErr.message || "Failed to load document." });
      }
    } finally {
      setIsLoadingDoc(false);
    }
  };

  // Render the current PDF page
  const renderCurrentPage = useCallback(async () => {
    if (!file) return;
    setIsRenderingPage(true);

    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
    }

    try {
      if (pdfDocRef.current) {
        const page = await pdfDocRef.current.getPage(currentPage);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

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

      // Backend fallback
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

  useEffect(() => {
    if (file) {
      renderCurrentPage();
    }
  }, [file, currentPage, zoom, renderCurrentPage]);

  // Fetch text blocks when in Edit Blocks mode
  useEffect(() => {
    if (file && detectBlocks) {
      const fetchBlocks = async () => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("page", currentPage.toString());
          const res = await api.getEditorTextBlocks(formData);
          setPageBlocks(res.blocks || []);
        } catch (err) {
          console.warn("Could not fetch text blocks:", err);
        }
      };
      fetchBlocks();
    } else {
      setPageBlocks([]);
    }
  }, [file, currentPage, detectBlocks]);

  // Redraw annotations on the overlay canvas
  const redrawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    const displayWidth = pageDimensions.width * zoom;
    const displayHeight = pageDimensions.height * zoom;
    const pixelRatio = window.devicePixelRatio || 1;

    overlay.width = displayWidth * pixelRatio;
    overlay.height = displayHeight * pixelRatio;
    overlay.style.width = `${displayWidth}px`;
    overlay.style.height = `${displayHeight}px`;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // If Edit Blocks mode is on, highlight existing document text blocks
    if (detectBlocks && pageBlocks.length > 0) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.45)";
      ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
      ctx.lineWidth = 1;
      for (const block of pageBlocks) {
        const [x0, y0, x1, y1] = block.bbox;
        const bx = x0 * zoom;
        const by = y0 * zoom;
        const bw = (x1 - x0) * zoom;
        const bh = (y1 - y0) * zoom;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
      }
    }

    // Filter user annotations for current page
    const pageEdits = edits.filter((e) => e.page === currentPage);

    for (const edit of pageEdits) {
      const isSelected = edit.id === selectedEditId;
      const x = edit.x * zoom;
      const y = edit.y * zoom;

      if (edit.type === "text" && edit.text) {
        ctx.fillStyle = edit.color || "#0f172a";
        ctx.font = `${(edit.fontSize || 14) * zoom}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(edit.text, x, y);

        if (isSelected) {
          const metrics = ctx.measureText(edit.text);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(x - 4, y - 2, metrics.width + 8, (edit.fontSize || 14) * zoom + 4);
          ctx.setLineDash([]);
        }
      } else if (edit.type === "whiteout" && edit.width && edit.height) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, edit.width * zoom, edit.height * zoom);
        ctx.strokeStyle = isSelected ? "#3b82f6" : "#e2e8f0";
        ctx.lineWidth = isSelected ? 2 : 1;
        if (isSelected) ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, edit.width * zoom, edit.height * zoom);
        ctx.setLineDash([]);
      } else if (edit.type === "highlight" && edit.width && edit.height) {
        ctx.fillStyle = "rgba(254, 240, 138, 0.45)";
        ctx.fillRect(x, y, edit.width * zoom, edit.height * zoom);
        if (isSelected) {
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, edit.width * zoom, edit.height * zoom);
        }
      } else if (edit.type === "rect" && edit.width && edit.height) {
        ctx.strokeStyle = isSelected ? "#2563eb" : (edit.color || "#3b82f6");
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

    // In-progress shapes
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
  }, [edits, currentPage, zoom, pageDimensions, isDrawing, currentLine, dragStart, dragCurrent, activeTool, textColor, strokeWidth, selectedEditId, detectBlocks, pageBlocks]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  // Convert mouse event coordinates to unscaled PDF points
  const getPDFCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPDFCoordinates(e);

    // If in Edit Blocks mode, check if clicked an existing text block
    if (detectBlocks && pageBlocks.length > 0) {
      const clickedBlock = pageBlocks.find(
        (b) =>
          coords.x >= b.bbox[0] &&
          coords.x <= b.bbox[2] &&
          coords.y >= b.bbox[1] &&
          coords.y <= b.bbox[3]
      );
      if (clickedBlock) {
        setEditingBlock({ block: clickedBlock, newText: clickedBlock.text });
        return;
      }
    }

    // Check if clicked an existing annotation to select it
    const pageEdits = edits.filter((item) => item.page === currentPage);
    const hitEdit = [...pageEdits].reverse().find((item) => {
      if (item.type === "text" && item.text) {
        const estWidth = item.text.length * (item.fontSize || 14) * 0.6;
        const estHeight = (item.fontSize || 14) * 1.2;
        return (
          coords.x >= item.x - 5 &&
          coords.x <= item.x + estWidth + 5 &&
          coords.y >= item.y - 5 &&
          coords.y <= item.y + estHeight + 5
        );
      }
      if ((item.type === "rect" || item.type === "highlight" || item.type === "whiteout") && item.width && item.height) {
        return (
          coords.x >= item.x &&
          coords.x <= item.x + item.width &&
          coords.y >= item.y &&
          coords.y <= item.y + item.height
        );
      }
      return false;
    });

    if (hitEdit) {
      setSelectedEditId(hitEdit.id);
      return;
    }

    // Deselect if clicked empty space
    setSelectedEditId(null);

    // If Text tool active, open inline text input at click location
    if (activeTool === "text") {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      setInlineTextInput({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pdfX: coords.x,
        pdfY: coords.y,
        text: "",
        fontSize: textSize,
        color: textColor,
      });
      return;
    }

    // Drawing / Shapes
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
      const newEdit: EditItem = {
        id: `line_${Date.now()}`,
        page: currentPage,
        type: "freehand",
        x: currentLine[0][0],
        y: currentLine[0][1],
        points: currentLine,
        color: textColor,
        strokeWidth: strokeWidth,
      };
      setEdits((prev) => [...prev, newEdit]);
      setSelectedEditId(newEdit.id);
    } else if (dragStart && dragCurrent && (activeTool === "highlight" || activeTool === "rect" || activeTool === "whiteout")) {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const width = Math.abs(dragCurrent.x - dragStart.x);
      const height = Math.abs(dragCurrent.y - dragStart.y);

      if (width > 3 && height > 3) {
        const newEdit: EditItem = {
          id: `shape_${Date.now()}`,
          page: currentPage,
          type: activeTool,
          x,
          y,
          width,
          height,
          color: textColor,
          strokeWidth: strokeWidth,
        };
        setEdits((prev) => [...prev, newEdit]);
        setSelectedEditId(newEdit.id);
      }
    }

    setIsDrawing(false);
    setCurrentLine([]);
    setDragStart(null);
    setDragCurrent(null);
  };

  // Commit inline text addition
  const handleCommitInlineText = () => {
    if (!inlineTextInput || !inlineTextInput.text.trim()) {
      setInlineTextInput(null);
      return;
    }

    const newEdit: EditItem = {
      id: `text_${Date.now()}`,
      page: currentPage,
      type: "text",
      x: inlineTextInput.pdfX,
      y: inlineTextInput.pdfY,
      text: inlineTextInput.text.trim(),
      color: inlineTextInput.color,
      fontSize: inlineTextInput.fontSize,
    };

    setEdits((prev) => [...prev, newEdit]);
    setSelectedEditId(newEdit.id);
    setInlineTextInput(null);
  };

  // Delete selected annotation
  const handleDeleteSelected = () => {
    if (!selectedEditId) return;
    setEdits((prev) => prev.filter((e) => e.id !== selectedEditId));
    setSelectedEditId(null);
  };

  // Clear all annotations on current page
  const handleClearCurrentPage = () => {
    const pageEditsCount = edits.filter((e) => e.page === currentPage).length;
    if (pageEditsCount === 0) return;
    if (confirm(`Remove all ${pageEditsCount} annotations from Page ${currentPage}?`)) {
      setEdits((prev) => prev.filter((e) => e.page !== currentPage));
      setSelectedEditId(null);
    }
  };

  // Clear ALL annotations across document
  const handleClearAllAnnotations = () => {
    if (edits.length === 0) return;
    if (confirm(`Clear all ${edits.length} annotations across the entire document?`)) {
      setEdits([]);
      setSelectedEditId(null);
    }
  };

  // Find & Replace Handler
  const handleExecuteFindReplace = async () => {
    if (!file || !findText.trim()) return;
    setIsReplacing(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("find_text", findText);
      formData.append("replace_text", replaceText);
      if (findScope === "page") {
        formData.append("page", currentPage.toString());
      }
      formData.append("color", replaceColor);

      const modifiedBlob = await api.replaceEditorText(formData);
      const updatedFile = new File([modifiedBlob], file.name, { type: "application/pdf" });
      setFile(updatedFile);

      // Re-load PDF into PDF.js
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await updatedFile.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = doc;

      // Re-render
      await renderCurrentPage();

      setShowFindReplace(false);
      setFindText("");
      setReplaceText("");
      setStatusMessage({
        type: "success",
        text: `Successfully replaced instances of "${findText}" with "${replaceText}".`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to replace text." });
    } finally {
      setIsReplacing(false);
    }
  };

  // Delete Text Handler
  const handleExecuteDeleteText = async () => {
    if (!file || !deleteTextVal.trim()) return;
    setIsDeletingText(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("text_to_delete", deleteTextVal);
      if (deleteScope === "page") {
        formData.append("page", currentPage.toString());
      }

      const modifiedBlob = await api.deleteEditorText(formData);
      const updatedFile = new File([modifiedBlob], file.name, { type: "application/pdf" });
      setFile(updatedFile);

      const pdfjs = await loadPdfJs();
      const arrayBuffer = await updatedFile.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = doc;

      await renderCurrentPage();

      setShowDeleteText(false);
      setDeleteTextVal("");
      setStatusMessage({
        type: "success",
        text: `Permanently removed all instances of "${deleteTextVal}".`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to delete text." });
    } finally {
      setIsDeletingText(false);
    }
  };

  // Replace Clicked Block Handler
  const handleSaveBlockEdit = async () => {
    if (!file || !editingBlock) return;
    setIsUpdatingBlock(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page", currentPage.toString());
      formData.append("bbox_json", JSON.stringify(editingBlock.block.bbox));
      formData.append("new_text", editingBlock.newText);
      formData.append("color", textColor);

      const modifiedBlob = await api.replaceEditorBlock(formData);
      const updatedFile = new File([modifiedBlob], file.name, { type: "application/pdf" });
      setFile(updatedFile);

      const pdfjs = await loadPdfJs();
      const arrayBuffer = await updatedFile.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = doc;

      await renderCurrentPage();

      // Refresh blocks
      const blockFormData = new FormData();
      blockFormData.append("file", updatedFile);
      blockFormData.append("page", currentPage.toString());
      const res = await api.getEditorTextBlocks(blockFormData);
      setPageBlocks(res.blocks || []);

      setEditingBlock(null);
      setStatusMessage({ type: "success", text: "Text block updated successfully in document." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update block." });
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  // Save changes and download
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

      setStatusMessage({ type: "success", text: "Edited document downloaded successfully." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save edits to PDF." });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedEdit = edits.find((e) => e.id === selectedEditId);

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
            Comprehensive PDF Editor & Content Modifier
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Add custom text anywhere, replace existing document text, delete words, highlight sections, and sign pages with pixel-grade accuracy.
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
              <button onClick={() => setStatusMessage(null)} className="text-xs font-semibold hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Primary Operations Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-soft-md flex flex-wrap items-center justify-between gap-3">
            {/* Main Tools Group */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  setActiveTool("text");
                  setDetectBlocks(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "text" && !detectBlocks
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Click anywhere to type new text"
              >
                <Type className="w-4 h-4" />
                <span>Add Text</span>
              </button>

              <button
                onClick={() => {
                  setShowFindReplace(true);
                  setShowDeleteText(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/60 transition-all"
                title="Search and replace words or phrases in the document"
              >
                <Search className="w-4 h-4 text-amber-600" />
                <span>Find & Replace</span>
              </button>

              <button
                onClick={() => {
                  setShowDeleteText(true);
                  setShowFindReplace(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-200 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-200/60 dark:border-rose-800/60 transition-all"
                title="Erase or redact specific words from document"
              >
                <Eraser className="w-4 h-4 text-rose-600" />
                <span>Delete Text</span>
              </button>

              <button
                onClick={() => setDetectBlocks(!detectBlocks)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  detectBlocks
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                }`}
                title="Hover and click any existing text in the PDF to edit it"
              >
                <Eye className="w-4 h-4" />
                <span>Click-to-Edit Text</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool("freehand");
                  setDetectBlocks(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "freehand" && !detectBlocks
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>Draw / Sign</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool("highlight");
                  setDetectBlocks(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "highlight" && !detectBlocks
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Highlighter className="w-4 h-4 text-amber-500" />
                <span>Highlight</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool("whiteout");
                  setDetectBlocks(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTool === "whiteout" && !detectBlocks
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Draw a whiteout block over sensitive details"
              >
                <Square className="w-4 h-4 fill-white text-slate-400" />
                <span>Whiteout Box</span>
              </button>
            </div>

            {/* Pagination & Global Actions */}
            <div className="flex items-center gap-3">
              {/* Page Navigator */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                <button
                  disabled={currentPage <= 1 || isRenderingPage}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
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
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-xs">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.15).toFixed(2))))}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-xs text-slate-600 dark:text-slate-300 font-mono font-semibold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.0, parseFloat((z + 0.15).toFixed(2))))}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Save PDF Button */}
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

          {/* Find & Replace Bar (Expandable) */}
          {showFindReplace && (
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-soft-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-amber-600" />
                  Find & Replace:
                </span>
                <input
                  type="text"
                  placeholder="Find text (e.g. UNIT 4)"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-48 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">&rarr;</span>
                <input
                  type="text"
                  placeholder="Replace with (e.g. UNIT 5)"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-48 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <select
                  value={findScope}
                  onChange={(e) => setFindScope(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="page">Current Page (Page {currentPage})</option>
                  <option value="all">Entire Document ({totalPages} Pages)</option>
                </select>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <span>Color:</span>
                  <input
                    type="color"
                    value={replaceColor}
                    onChange={(e) => setReplaceColor(e.target.value)}
                    className="w-6 h-6 rounded-md border-0 p-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={isReplacing || !findText.trim()}
                  onClick={handleExecuteFindReplace}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm transition-all"
                >
                  {isReplacing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Replace Now</span>
                </button>
                <button
                  onClick={() => setShowFindReplace(false)}
                  className="p-1.5 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Delete Text Bar (Expandable) */}
          {showDeleteText && (
            <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 shadow-soft-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <Eraser className="w-4 h-4 text-rose-600" />
                  Permanently Delete Words:
                </span>
                <input
                  type="text"
                  placeholder="Text to erase (e.g. draft, confidential)"
                  value={deleteTextVal}
                  onChange={(e) => setDeleteTextVal(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-64 outline-none focus:ring-2 focus:ring-rose-500"
                />
                <select
                  value={deleteScope}
                  onChange={(e) => setDeleteScope(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="page">Current Page (Page {currentPage})</option>
                  <option value="all">Entire Document ({totalPages} Pages)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={isDeletingText || !deleteTextVal.trim()}
                  onClick={handleExecuteDeleteText}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-sm transition-all"
                >
                  {isDeletingText ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Erase Text</span>
                </button>
                <button
                  onClick={() => setShowDeleteText(false)}
                  className="p-1.5 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Secondary Formatting Bar for Active Tool */}
          <div className="flex flex-wrap items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 px-4 rounded-xl border border-slate-200/80 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              {activeTool === "text" && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-semibold">New Text Settings:</span>
                  <div className="flex items-center gap-1.5">
                    <span>Size:</span>
                    <select
                      value={textSize}
                      onChange={(e) => setTextSize(Number(e.target.value))}
                      className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value={10}>10pt</option>
                      <option value={12}>12pt</option>
                      <option value={14}>14pt</option>
                      <option value={18}>18pt</option>
                      <option value={24}>24pt</option>
                      <option value={32}>32pt</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Color:</span>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-5 h-5 rounded border-0 p-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-slate-400 italic">Click on the document to place note</span>
                </div>
              )}

              {detectBlocks && (
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                  <Eye className="w-4 h-4" />
                  <span>Click-to-Edit Mode: Click any highlighted text box on the document to edit its words.</span>
                </div>
              )}

              {activeTool === "freehand" && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-semibold">Pen Settings:</span>
                  <div className="flex items-center gap-1.5">
                    <span>Width:</span>
                    <select
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={4}>4px</option>
                      <option value={6}>6px</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Color:</span>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-5 h-5 rounded border-0 p-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Annotation Management */}
            <div className="flex items-center gap-3">
              {selectedEdit && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="font-semibold">Selected: {selectedEdit.type}</span>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1 text-rose-600 hover:bg-rose-100 rounded"
                    title="Delete this annotation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {edits.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearCurrentPage}
                    className="text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors"
                  >
                    Clear Page ({edits.filter((e) => e.page === currentPage).length})
                  </button>
                  <span>•</span>
                  <button
                    onClick={handleClearAllAnnotations}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold transition-colors"
                  >
                    Clear All ({edits.length})
                  </button>
                </div>
              )}
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

              {/* Active Inline Text Input Popup */}
              {inlineTextInput && (
                <div
                  style={{
                    position: "absolute",
                    left: `${inlineTextInput.x}px`,
                    top: `${inlineTextInput.y}px`,
                    transform: "translate(0, -10px)",
                  }}
                  className="z-30 bg-white dark:bg-slate-900 border-2 border-brand-500 rounded-xl p-2 shadow-2xl flex flex-col gap-2 min-w-[240px]"
                >
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">New Text Note</span>
                    <button
                      onClick={() => setInlineTextInput(null)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    autoFocus
                    rows={2}
                    placeholder="Type note or text..."
                    value={inlineTextInput.text}
                    onChange={(e) => setInlineTextInput({ ...inlineTextInput, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleCommitInlineText();
                      }
                    }}
                    className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={inlineTextInput.fontSize}
                        onChange={(e) => setInlineTextInput({ ...inlineTextInput, fontSize: Number(e.target.value) })}
                        className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                      >
                        <option value={10}>10pt</option>
                        <option value={12}>12pt</option>
                        <option value={14}>14pt</option>
                        <option value={18}>18pt</option>
                        <option value={24}>24pt</option>
                      </select>
                      <input
                        type="color"
                        value={inlineTextInput.color}
                        onChange={(e) => setInlineTextInput({ ...inlineTextInput, color: e.target.value })}
                        className="w-5 h-5 rounded border-0 p-0 cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={handleCommitInlineText}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Place</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Block Edit Popover */}
              {editingBlock && (
                <div
                  style={{
                    position: "absolute",
                    left: `${editingBlock.block.bbox[0] * zoom}px`,
                    top: `${Math.max(0, editingBlock.block.bbox[1] * zoom - 60)}px`,
                  }}
                  className="z-30 bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 min-w-[320px] max-w-[420px]"
                >
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Edit Document Text Block</span>
                    <button onClick={() => setEditingBlock(null)} className="p-0.5 text-slate-400 hover:text-slate-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={editingBlock.newText}
                    onChange={(e) => setEditingBlock({ ...editingBlock, newText: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      onClick={() => setEditingBlock({ ...editingBlock, newText: "" })}
                      className="text-rose-500 hover:underline"
                    >
                      Erase / Delete
                    </button>
                    <button
                      disabled={isUpdatingBlock}
                      onClick={handleSaveBlockEdit}
                      className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                    >
                      {isUpdatingBlock ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Apply Update</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Info & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 px-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{file.name}</span>
              <span>•</span>
              <span>{totalPages} total pages</span>
              <span>•</span>
              <span>{edits.length} manual annotation{edits.length === 1 ? "" : "s"}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <button
                onClick={() => {
                  setFile(null);
                  setEdits([]);
                }}
                className="text-brand-600 hover:underline font-semibold"
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
