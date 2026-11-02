export interface ToolDefinition {
  id: string;
  name: string;
  tagline: string;
  category: "organize" | "optimize" | "convert" | "edit" | "security" | "ocr" | "ai";
  iconName: string;
  apiEndpoint: string;
  route: string;
  acceptsMultiple: boolean;
  acceptedFileTypes: string[]; // e.g. [".pdf"]
  description: string;
  badge?: string;
}

export const TOOLS_REGISTRY: ToolDefinition[] = [
  // Organize
  {
    id: "merge",
    name: "Merge PDF",
    tagline: "Combine multiple PDF files into one ordered document.",
    category: "organize",
    iconName: "Layers",
    apiEndpoint: "/tools/merge",
    route: "/tools/merge",
    acceptsMultiple: true,
    acceptedFileTypes: [".pdf"],
    description: "Upload two or more PDFs to merge them into a single, cohesive document. Drag and drop to reorder pages as needed.",
    badge: "Popular"
  },
  {
    id: "split",
    name: "Split PDF",
    tagline: "Extract page ranges or separate all pages into individual files.",
    category: "organize",
    iconName: "Split",
    apiEndpoint: "/tools/split",
    route: "/tools/split",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Specify page ranges like '1-3, 5' to extract targeted sections, or split the entire document into separate pages packaged in a ZIP.",
    badge: "Popular"
  },
  {
    id: "rotate",
    name: "Rotate PDF",
    tagline: "Rotate pages 90°, 180°, or 270° in clockwise orientation.",
    category: "organize",
    iconName: "RotateCw",
    apiEndpoint: "/tools/rotate",
    route: "/tools/rotate",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Rotate landscape scans to portrait or fix upside-down pages across the entire document or selected page numbers.",
  },
  {
    id: "page-numbers",
    name: "Page Numbers",
    tagline: "Insert customizable page numbers, headers, and footers.",
    category: "organize",
    iconName: "Hash",
    apiEndpoint: "/tools/page-numbers",
    route: "/tools/page-numbers",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Add professional page numbering (e.g., 'Page 1 of 12') positioned at bottom-center, top-right, or custom margins.",
  },
  {
    id: "crop",
    name: "Crop PDF",
    tagline: "Trim unwanted page margins and adjust visible dimensions.",
    category: "organize",
    iconName: "Crop",
    apiEndpoint: "/tools/crop",
    route: "/tools/crop",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Adjust boundary boxes to crop excessive whitespace and focus on primary text and graphics.",
  },

  // Optimize
  {
    id: "compress",
    name: "Compress PDF",
    tagline: "Reduce PDF file size while maintaining high visual clarity.",
    category: "optimize",
    iconName: "Minimize2",
    apiEndpoint: "/tools/compress",
    route: "/tools/compress",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Optimize vector streams, resample high-resolution raster images, and calculate the exact percentage of space saved.",
    badge: "Popular"
  },

  // Convert
  {
    id: "pdf-to-docx",
    name: "PDF to Word",
    tagline: "Convert PDFs into editable Microsoft Word (.docx) documents.",
    category: "convert",
    iconName: "FileText",
    apiEndpoint: "/tools/convert/pdf-to-docx",
    route: "/tools/pdf-to-docx",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Extract text, headings, and formatting into clean DOCX files ready for Microsoft Word, Google Docs, and LibreOffice.",
    badge: "Popular"
  },
  {
    id: "docx-to-pdf",
    name: "Word to PDF",
    tagline: "Convert Microsoft Word documents (.docx) into pristine PDFs.",
    category: "convert",
    iconName: "FileType",
    apiEndpoint: "/tools/convert/docx-to-pdf",
    route: "/tools/docx-to-pdf",
    acceptsMultiple: false,
    acceptedFileTypes: [".docx"],
    description: "Render DOCX paragraphs and tables into a standardized, shareable PDF document.",
  },
  {
    id: "pdf-to-images",
    name: "PDF to Images",
    tagline: "Render each PDF page as high-resolution PNG or JPG graphics.",
    category: "convert",
    iconName: "Image",
    apiEndpoint: "/tools/convert/pdf-to-images",
    route: "/tools/pdf-to-images",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Render pages at 150+ DPI and download as individual PNG/JPG images packaged in a ZIP archive.",
  },
  {
    id: "images-to-pdf",
    name: "Images to PDF",
    tagline: "Combine JPG, PNG, and WebP images into a single PDF.",
    category: "convert",
    iconName: "Images",
    apiEndpoint: "/tools/convert/images-to-pdf",
    route: "/tools/images-to-pdf",
    acceptsMultiple: true,
    acceptedFileTypes: [".jpg", ".jpeg", ".png", ".webp"],
    description: "Upload photo scans, screenshots, or receipts and compile them into a unified PDF booklet.",
  },
  {
    id: "pdf-to-excel",
    name: "PDF to Excel",
    tagline: "Extract tabular data and grids directly into XLSX sheets.",
    category: "convert",
    iconName: "Sheet",
    apiEndpoint: "/tools/convert/pdf-to-excel",
    route: "/tools/pdf-to-excel",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Detect tabular structures across PDF pages and export cell coordinates directly into Microsoft Excel spreadsheets.",
  },
  {
    id: "text-to-pdf",
    name: "Text to PDF",
    tagline: "Format plain text or notes into a beautifully typed PDF.",
    category: "convert",
    iconName: "AlignLeft",
    apiEndpoint: "/tools/convert/text-to-pdf",
    route: "/tools/text-to-pdf",
    acceptsMultiple: false,
    acceptedFileTypes: [".txt", ".md"],
    description: "Transform raw text, scripts, or markdown notes into a professionally typeset PDF document.",
  },
  {
    id: "pdf-to-markdown",
    name: "PDF to Markdown",
    tagline: "Convert PDF text into clean, structured Markdown.",
    category: "convert",
    iconName: "Code",
    apiEndpoint: "/tools/convert/pdf-to-markdown",
    route: "/tools/pdf-to-markdown",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Extract headings, bullet lists, and paragraphs formatted for Markdown note-taking tools and LLM pipelines.",
  },

  // Edit
  {
    id: "editor",
    name: "Edit PDF",
    tagline: "View, annotate, draw, and insert text onto your PDF documents.",
    category: "edit",
    iconName: "Edit3",
    apiEndpoint: "/editor/save-edits",
    route: "/tools/editor",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Interactive canvas viewer with zoom, page navigation, freehand drawing, rectangle highlights, and custom text stamps.",
    badge: "Interactive"
  },

  // Security
  {
    id: "protect",
    name: "Protect PDF",
    tagline: "Encrypt your PDF with robust AES-256 password protection.",
    category: "security",
    iconName: "Lock",
    apiEndpoint: "/tools/protect",
    route: "/tools/protect",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Enforce confidential access by encrypting the document with bank-grade AES-256 standard encryption.",
    badge: "Security"
  },
  {
    id: "unlock",
    name: "Unlock PDF",
    tagline: "Remove password encryption from your authorized PDF files.",
    category: "security",
    iconName: "Unlock",
    apiEndpoint: "/tools/unlock",
    route: "/tools/unlock",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Decrypt password-protected files when you supply the valid password, creating a permanent unencrypted copy.",
  },
  {
    id: "watermark",
    name: "Watermark PDF",
    tagline: "Stamp diagonal semi-transparent watermarks across all pages.",
    category: "security",
    iconName: "Stamp",
    apiEndpoint: "/tools/watermark",
    route: "/tools/watermark",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Protect intellectual property with custom watermark text, adjustable opacity, custom rotation, and color tones.",
  },
  {
    id: "redact",
    name: "Redact PDF",
    tagline: "Permanently erase sensitive text and figures irreversibly.",
    category: "security",
    iconName: "EyeOff",
    apiEndpoint: "/tools/redact",
    route: "/tools/redact",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Deep redaction that permanently purges underlying text and vector streams so confidential data cannot be recovered.",
    badge: "Security"
  },

  // OCR & Utilities
  {
    id: "inspect-ocr",
    name: "OCR & Scan Inspector",
    tagline: "Inspect PDF layers to detect scanned pages and digital text.",
    category: "ocr",
    iconName: "ScanText",
    apiEndpoint: "/tools/inspect-ocr",
    route: "/tools/inspect-ocr",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Detect whether a document contains searchable digital text or consists of scanned raster images.",
  },
  {
    id: "compare",
    name: "Compare PDFs",
    tagline: "Compare two versions of a document and highlight differences.",
    category: "ocr",
    iconName: "GitCompare",
    apiEndpoint: "/tools/compare",
    route: "/tools/compare",
    acceptsMultiple: true,
    acceptedFileTypes: [".pdf"],
    description: "Compare two documents side-by-side to uncover additions, deletions, and structural revisions.",
  },
  {
    id: "repair",
    name: "Repair PDF",
    tagline: "Recover malformed xref tables and damaged PDF streams.",
    category: "ocr",
    iconName: "Wrench",
    apiEndpoint: "/tools/repair",
    route: "/tools/repair",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Best-effort reconstruction of broken cross-reference tables and incomplete object streams.",
  },

  // AI Document Intelligence
  {
    id: "ai-summarize",
    name: "AI Summarizer",
    tagline: "Generate grounded summaries with precise page references.",
    category: "ai",
    iconName: "Sparkles",
    apiEndpoint: "/ai/summarize",
    route: "/ai-assistant",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Intelligent document summarization powered by Google Gemini, grounding every point with page citations.",
    badge: "AI Powered"
  },
  {
    id: "ai-chat",
    name: "Chat with PDF",
    tagline: "Ask questions and get answers grounded strictly in document text.",
    category: "ai",
    iconName: "MessageSquare",
    apiEndpoint: "/ai/chat",
    route: "/ai-assistant",
    acceptsMultiple: false,
    acceptedFileTypes: [".pdf"],
    description: "Multi-turn grounded conversational reasoning across single or multiple documents with citation highlights.",
    badge: "AI Powered"
  }
];

export const CATEGORIES = [
  { id: "all", label: "All Tools" },
  { id: "organize", label: "Organize" },
  { id: "optimize", label: "Optimize" },
  { id: "convert", label: "Convert" },
  { id: "edit", label: "Edit & Annotate" },
  { id: "security", label: "Security & Redaction" },
  { id: "ocr", label: "OCR & Utilities" },
  { id: "ai", label: "AI Intelligence" },
];
