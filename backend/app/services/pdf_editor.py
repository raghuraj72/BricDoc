import io
from typing import List, Dict, Any
import pymupdf
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

class PDFEditorService:
    """
    Service for applying vector annotations, text additions,
    freehand drawings, and stamps onto PDF pages.
    """

    @staticmethod
    def apply_edits(pdf_bytes: bytes, edits: List[Dict[str, Any]]) -> bytes:
        """
        Apply a series of edits (text, rectangle, highlight, drawing) to a PDF.
        Each edit dict has:
        - page: 1-based page number
        - type: 'text' | 'rect' | 'highlight' | 'freehand'
        - properties: coordinates, text, color, stroke_width, font_size, etc.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")

        for edit in edits:
            p_num = edit.get("page", 1) - 1
            if not (0 <= p_num < len(doc)):
                continue
            page = doc[p_num]
            edit_type = edit.get("type")

            if edit_type == "text":
                x = edit.get("x", 50)
                y = edit.get("y", 50)
                text = edit.get("text", "")
                font_size = edit.get("fontSize", 12)
                color = edit.get("color", "#111827")
                # Convert hex color to RGB tuple (0-1)
                c_clean = color.lstrip("#")
                if len(c_clean) == 6:
                    rgb = tuple(int(c_clean[i:i+2], 16) / 255.0 for i in (0, 2, 4))
                else:
                    rgb = (0, 0, 0)
                page.insert_text(pymupdf.Point(x, y), text, fontsize=font_size, color=rgb)

            elif edit_type == "highlight":
                x = edit.get("x", 50)
                y = edit.get("y", 50)
                w = edit.get("width", 100)
                h = edit.get("height", 20)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                annot = page.add_highlight_annot(rect)
                annot.update()

            elif edit_type == "rect":
                x = edit.get("x", 50)
                y = edit.get("y", 50)
                w = edit.get("width", 100)
                h = edit.get("height", 60)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                page.draw_rect(rect, color=(0.2, 0.4, 0.8), width=1.5)

            elif edit_type == "freehand":
                points = edit.get("points", [])  # list of [x, y]
                if len(points) >= 2:
                    mupdf_points = [pymupdf.Point(pt[0], pt[1]) for pt in points]
                    for i in range(len(mupdf_points) - 1):
                        page.draw_line(mupdf_points[i], mupdf_points[i+1], color=(0.1, 0.1, 0.1), width=2.0)

        out_bytes = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return out_bytes
