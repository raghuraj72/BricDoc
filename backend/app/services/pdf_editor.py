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
    find-and-replace, text deletion, and block replacement on PDF pages.
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
    def get_page_text_blocks(pdf_bytes: bytes, page_num: int = 1) -> List[Dict[str, Any]]:
        """
        Extract all text blocks on a page with their bounding boxes and text content
        for interactive click-to-edit.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        if not (1 <= page_num <= len(doc)):
            doc.close()
            return []
        page = doc[page_num - 1]
        blocks = []
        for b in page.get_text("blocks"):
            if b[6] == 0:  # text block
                text_clean = b[4].strip()
                if text_clean:
                    blocks.append({
                        "bbox": [round(coord, 2) for coord in b[:4]],
                        "text": text_clean,
                        "block_id": b[5]
                    })
        doc.close()
        return blocks

    @staticmethod
    def replace_text(
        pdf_bytes: bytes,
        find_text: str,
        replace_text: str,
        page_num: Optional[int] = None,
        font_size: Optional[float] = None,
        color: Optional[str] = "#000000",
        match_case: bool = False
    ) -> bytes:
        """
        Find and replace text across one or all pages using PyMuPDF redaction
        and text insertion.
        """
        if not find_text:
            return pdf_bytes

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        rgb = hex_to_rgb(color, default=(0.0, 0.0, 0.0))

        pages_to_process = [page_num - 1] if page_num and 1 <= page_num <= len(doc) else list(range(len(doc)))

        for p_idx in pages_to_process:
            page = doc[p_idx]
            rects = page.search_for(find_text)
            if not rects:
                continue

            # First redact (erase old text)
            for r in rects:
                page.add_redact_annot(r, fill=(1.0, 1.0, 1.0))
            page.apply_redactions()

            # Insert replacement text
            for r in rects:
                calc_fs = font_size if font_size else max(8.0, (r.y1 - r.y0) * 0.75)
                page.insert_text(pymupdf.Point(r.x0, r.y1 - 2), replace_text, fontsize=calc_fs, color=rgb)

        out_bytes = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return out_bytes

    @staticmethod
    def delete_text(
        pdf_bytes: bytes,
        text_to_delete: str,
        page_num: Optional[int] = None
    ) -> bytes:
        """
        Find and permanently redact/delete text across one or all pages.
        """
        if not text_to_delete:
            return pdf_bytes

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        pages_to_process = [page_num - 1] if page_num and 1 <= page_num <= len(doc) else list(range(len(doc)))

        for p_idx in pages_to_process:
            page = doc[p_idx]
            rects = page.search_for(text_to_delete)
            if not rects:
                continue

            for r in rects:
                page.add_redact_annot(r, fill=(1.0, 1.0, 1.0))
            page.apply_redactions()

        out_bytes = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return out_bytes

    @staticmethod
    def replace_block(
        pdf_bytes: bytes,
        page_num: int,
        bbox: List[float],
        new_text: str,
        font_size: Optional[float] = None,
        color: Optional[str] = "#000000"
    ) -> bytes:
        """
        Replace a specific text block at bbox [x0, y0, x1, y1] on page_num.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        if not (1 <= page_num <= len(doc)):
            doc.close()
            return pdf_bytes

        page = doc[page_num - 1]
        r = pymupdf.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
        page.add_redact_annot(r, fill=(1.0, 1.0, 1.0))
        page.apply_redactions()

        if new_text.strip():
            rgb = hex_to_rgb(color, default=(0.0, 0.0, 0.0))
            calc_fs = font_size if font_size else max(8.0, (r.y1 - r.y0) * 0.75)
            page.insert_text(pymupdf.Point(r.x0, r.y1 - 2), new_text, fontsize=calc_fs, color=rgb)

        out_bytes = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return out_bytes

    @staticmethod
    def apply_edits(pdf_bytes: bytes, edits: List[Dict[str, Any]]) -> bytes:
        """
        Apply a series of edits (text, rectangle, highlight, drawing, whiteout) to a PDF.
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
