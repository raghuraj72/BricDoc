import io
import base64
from typing import List, Dict, Any, Optional
import pymupdf
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

def hex_to_rgb(hex_str: Optional[str], default=(0.0, 0.0, 0.0)) -> tuple:
    if not hex_str:
        return default
    c = hex_str.lstrip("#")
    if len(c) == 6:
        try:
            return tuple(int(c[i:i+2], 16) / 255.0 for i in (0, 2, 4))
        except ValueError:
            return default
    return default

class PDFEditorService:
    """
    Service for inspecting, rendering, and applying vector annotations,
    text additions, freehand drawings, and stamps onto PDF pages.
    """

    @staticmethod
    def get_info(pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Inspect PDF metadata, page count, and page dimensions.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        for i, page in enumerate(doc):
            pages.append({
                "page": i + 1,
                "width": round(page.rect.width, 2),
                "height": round(page.rect.height, 2)
            })
        total = len(doc)
        doc.close()
        return {
            "total_pages": total,
            "pages": pages
        }

    @staticmethod
    def render_page(pdf_bytes: bytes, page_num: int = 1, dpi: int = 150) -> Dict[str, Any]:
        """
        Render a specific page of a PDF as a high-fidelity base64 PNG data URL.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        total = len(doc)
        if total == 0:
            doc.close()
            raise ValueError("Document has no pages")
        p_idx = max(0, min(page_num - 1, total - 1))
        page = doc[p_idx]
        rect = page.rect
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        b64_img = base64.b64encode(img_bytes).decode("utf-8")
        doc.close()
        return {
            "page": p_idx + 1,
            "total_pages": total,
            "width": round(rect.width, 2),
            "height": round(rect.height, 2),
            "image": f"data:image/png;base64,{b64_img}"
        }

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
                rgb = hex_to_rgb(edit.get("color"), default=(0.07, 0.09, 0.15))
                page.insert_text(pymupdf.Point(x, y), text, fontsize=font_size, color=rgb)

            elif edit_type == "highlight":
                x = edit.get("x", 50)
                y = edit.get("y", 50)
                w = edit.get("width", 100)
                h = edit.get("height", 20)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                annot = page.add_highlight_annot(rect)
                hl_color = hex_to_rgb(edit.get("color"), default=(1.0, 0.95, 0.0))
                annot.set_colors(stroke=hl_color)
                annot.update()

            elif edit_type == "whiteout":
                x = edit.get("x", 50)
                y = edit.get("y", 50)
                w = edit.get("width", 100)
                h = edit.get("height", 20)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                page.draw_rect(rect, color=(1.0, 1.0, 1.0), fill=(1.0, 1.0, 1.0))

            elif edit_type == "rect":
                x = edit.get("x", 50)
                y = edit.get("y", 50)
                w = edit.get("width", 100)
                h = edit.get("height", 60)
                stroke_color = hex_to_rgb(edit.get("color"), default=(0.23, 0.51, 0.96))
                stroke_w = edit.get("strokeWidth", 1.5)
                fill_c = hex_to_rgb(edit.get("fillColor")) if edit.get("fillColor") else None
                rect = pymupdf.Rect(x, y, x + w, y + h)
                page.draw_rect(rect, color=stroke_color, fill=fill_c, width=stroke_w)

            elif edit_type == "freehand":
                points = edit.get("points", [])  # list of [x, y]
                if len(points) >= 2:
                    stroke_color = hex_to_rgb(edit.get("color"), default=(0.07, 0.09, 0.15))
                    stroke_w = edit.get("strokeWidth", 2.0)
                    mupdf_points = [pymupdf.Point(pt[0], pt[1]) for pt in points]
                    for i in range(len(mupdf_points) - 1):
                        page.draw_line(mupdf_points[i], mupdf_points[i+1], color=stroke_color, width=stroke_w)

        out_bytes = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return out_bytes
