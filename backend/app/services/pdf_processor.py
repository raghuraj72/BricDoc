import io
from pathlib import Path
from typing import List, Optional, Tuple, Union
import pypdf
import pymupdf  # PyMuPDF
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from PIL import Image

class PDFProcessor:
    """
    Production-grade PDF processing service.
    Performs real page manipulation, optimization, compression, and numbering.
    """

    @staticmethod
    def merge_pdfs(input_pdf_bytes_list: List[bytes]) -> bytes:
        """Merge multiple PDF byte streams in order."""
        if not input_pdf_bytes_list:
            raise ValueError("At least one PDF file is required to merge.")
            
        writer = pypdf.PdfWriter()
        for pdf_bytes in input_pdf_bytes_list:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                writer.add_page(page)
                
        output_stream = io.BytesIO()
        writer.write(output_stream)
        return output_stream.getvalue()

    @staticmethod
    def parse_page_ranges(range_str: str, total_pages: int) -> List[int]:
        """
        Parse human-readable range strings like '1-3, 5, 7-9' into 0-based page indices.
        """
        selected_pages = set()
        parts = [p.strip() for p in range_str.split(",") if p.strip()]
        for part in parts:
            if "-" in part:
                start_s, end_s = part.split("-", 1)
                start = max(1, int(start_s.strip()))
                end = min(total_pages, int(end_s.strip()))
                for p in range(start, end + 1):
                    selected_pages.add(p - 1)
            else:
                p = int(part.strip())
                if 1 <= p <= total_pages:
                    selected_pages.add(p - 1)
        return sorted(list(selected_pages))

    @staticmethod
    def split_pdf(pdf_bytes: bytes, range_str: Optional[str] = None) -> Union[bytes, List[Tuple[str, bytes]]]:
        """
        Split a PDF by range or into individual pages.
        If range_str is given, returns single merged PDF of those ranges.
        If range_str is None, returns a list of (page_filename, page_bytes) for every page.
        """
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        if total_pages == 0:
            raise ValueError("PDF contains no pages.")

        if range_str:
            indices = PDFProcessor.parse_page_ranges(range_str, total_pages)
            if not indices:
                raise ValueError("No valid pages found in specified ranges.")
            writer = pypdf.PdfWriter()
            for idx in indices:
                writer.add_page(reader.pages[idx])
            out = io.BytesIO()
            writer.write(out)
            return out.getvalue()
        else:
            pages_out = []
            for i, page in enumerate(reader.pages):
                writer = pypdf.PdfWriter()
                writer.add_page(page)
                out = io.BytesIO()
                writer.write(out)
                pages_out.append((f"page_{i + 1}.pdf", out.getvalue()))
            return pages_out

    @staticmethod
    def extract_pages(pdf_bytes: bytes, page_numbers: List[int]) -> bytes:
        """Extract specific 1-based page numbers into a new PDF."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        writer = pypdf.PdfWriter()
        
        for p_num in page_numbers:
            idx = p_num - 1
            if 0 <= idx < total_pages:
                writer.add_page(reader.pages[idx])
                
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def delete_pages(pdf_bytes: bytes, pages_to_delete: List[int]) -> bytes:
        """Delete specific 1-based page numbers from a PDF."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        delete_set = {p - 1 for p in pages_to_delete}
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(reader.pages):
            if idx not in delete_set:
                writer.add_page(page)
                
        if len(writer.pages) == 0:
            raise ValueError("Cannot delete all pages from document.")
            
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def rotate_pages(pdf_bytes: bytes, angle: int = 90, page_numbers: Optional[List[int]] = None) -> bytes:
        """Rotate pages by angle degrees (90, 180, 270)."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()
        target_indices = {p - 1 for p in page_numbers} if page_numbers else None
        
        for idx, page in enumerate(reader.pages):
            if target_indices is None or idx in target_indices:
                page.rotate(angle)
            writer.add_page(page)
            
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def reorder_pages(pdf_bytes: bytes, new_order: List[int]) -> bytes:
        """Reorder pages according to a list of 1-based page numbers."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        writer = pypdf.PdfWriter()
        
        for p_num in new_order:
            idx = p_num - 1
            if 0 <= idx < total_pages:
                writer.add_page(reader.pages[idx])
                
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def add_page_numbers(
        pdf_bytes: bytes,
        position: str = "bottom-center",
        start_number: int = 1,
        font_size: int = 10,
        margin: int = 36
    ) -> bytes:
        """Add clean page numbers overlaid onto every page."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()
        total_pages = len(reader.pages)
        
        for idx, page in enumerate(reader.pages):
            page_num_val = start_number + idx
            page_text = f"Page {page_num_val} of {start_number + total_pages - 1}"
            
            # Read dimensions from source page
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)
            
            # Create an in-memory transparent canvas
            packet = io.BytesIO()
            can = canvas.Canvas(packet, pagesize=(page_w, page_h))
            can.setFont("Helvetica", font_size)
            can.setFillColor(HexColor("#4b5563"))
            
            # Calculate coordinates based on position
            if position == "bottom-left":
                x, y = margin, margin
                can.drawString(x, y, page_text)
            elif position == "bottom-right":
                can.drawRightString(page_w - margin, margin, page_text)
            elif position == "top-center":
                can.drawCentredString(page_w / 2.0, page_h - margin, page_text)
            elif position == "top-right":
                can.drawRightString(page_w - margin, page_h - margin, page_text)
            elif position == "top-left":
                can.drawString(margin, page_h - margin, page_text)
            else:  # bottom-center
                can.drawCentredString(page_w / 2.0, margin, page_text)
                
            can.save()
            packet.seek(0)
            
            overlay_reader = pypdf.PdfReader(packet)
            page.merge_page(overlay_reader.pages[0])
            writer.add_page(page)
            
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def compress_pdf(pdf_bytes: bytes, level: str = "recommended") -> bytes:
        """
        Compress PDF content streams and image data using PyMuPDF and pypdf.
        Calculates real size reduction.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        
        # Deflate and clean streams
        garbage_level = 4 if level in ["extreme", "recommended"] else 2
        deflate = True
        
        out_stream = doc.tobytes(
            garbage=garbage_level,
            deflate=deflate,
            clean=True,
            deflate_images=True,
            deflate_fonts=True
        )
        doc.close()
        
        # Secondary pass with pypdf to strip duplicate content streams if size allows
        try:
            reader = pypdf.PdfReader(io.BytesIO(out_stream))
            writer = pypdf.PdfWriter()
            for page in reader.pages:
                page.compress_content_streams()
                writer.add_page(page)
            buf = io.BytesIO()
            writer.write(buf)
            secondary = buf.getvalue()
            if len(secondary) < len(out_stream):
                return secondary
        except Exception:
            pass

        return out_stream

    @staticmethod
    def crop_pages(pdf_bytes: bytes, margin_points: float = 36.0) -> bytes:
        """Crop visible boundaries of every page by inset margin."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()
        
        for page in reader.pages:
            box = page.mediabox
            box.lower_left = (box.lower_left[0] + margin_points, box.lower_left[1] + margin_points)
            box.upper_right = (box.upper_right[0] - margin_points, box.upper_right[1] - margin_points)
            writer.add_page(page)
            
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
