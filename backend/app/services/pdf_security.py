import io
import math
from typing import List, Optional
import pypdf
import pymupdf
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

class PDFSecurity:
    """
    Security service handling password encryption, unlocking,
    permanent irreversible redactions, and watermarking.
    """

    @staticmethod
    def protect_pdf(pdf_bytes: bytes, user_password: str, owner_password: Optional[str] = None) -> bytes:
        """Encrypt PDF with AES-256 encryption."""
        if not user_password:
            raise ValueError("Password cannot be empty.")
            
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()
        
        for page in reader.pages:
            writer.add_page(page)
            
        writer.encrypt(
            user_password=user_password,
            owner_password=owner_password or user_password,
            algorithm="AES-256"
        )
        
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def unlock_pdf(pdf_bytes: bytes, password: str) -> bytes:
        """Decrypt password-protected PDF and save an unencrypted copy."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            success = reader.decrypt(password)
            if not success:
                raise ValueError("Incorrect password provided for document.")
                
        writer = pypdf.PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
            
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def add_watermark(
        pdf_bytes: bytes,
        text: str,
        opacity: float = 0.3,
        font_size: int = 48,
        rotation: int = 45,
        color_hex: str = "#6b7280"
    ) -> bytes:
        """Apply diagonal semi-transparent watermark across all pages."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()

        for page in reader.pages:
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)

            packet = io.BytesIO()
            can = canvas.Canvas(packet, pagesize=(page_w, page_h))
            can.setFont("Helvetica-Bold", font_size)
            
            # Setup fill color with opacity
            c = HexColor(color_hex)
            can.setFillColor(c, alpha=opacity)
            can.setStrokeColor(c, alpha=opacity)

            can.saveState()
            can.translate(page_w / 2.0, page_h / 2.0)
            can.rotate(rotation)
            can.drawCentredString(0, 0, text)
            can.restoreState()

            can.save()
            packet.seek(0)

            watermark_reader = pypdf.PdfReader(packet)
            page.merge_page(watermark_reader.pages[0])
            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()

    @staticmethod
    def redact_pdf(
        pdf_bytes: bytes,
        redaction_boxes: List[dict]
    ) -> bytes:
        """
        Permanently and irreversibly redact areas from PDF.
        Removes underlying text and images so content is not recoverable.
        redaction_boxes: list of {'page_number': 1-based, 'x': float, 'y': float, 'width': float, 'height': float}
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        
        for item in redaction_boxes:
            p_num = item.get("page_number", 1) - 1
            if 0 <= p_num < len(doc):
                page = doc[p_num]
                x = item.get("x", 0)
                y = item.get("y", 0)
                w = item.get("width", 100)
                h = item.get("height", 20)
                rect = pymupdf.Rect(x, y, x + w, y + h)
                
                # Add annot and apply redaction permanently
                page.add_redact_annot(rect, fill=(0, 0, 0))
                page.apply_redactions()

        out_bytes = doc.tobytes(garbage=4, deflate=True)
        doc.close()
        return out_bytes
