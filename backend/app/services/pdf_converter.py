import io
import csv
import zipfile
from pathlib import Path
from typing import List, Tuple, Union
import pymupdf
import pdfplumber
import openpyxl
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import docx

class PDFConverter:
    """
    Real document conversion service supporting bidirectional PDF transformations.
    """

    @staticmethod
    def pdf_to_images(pdf_bytes: bytes, image_format: str = "png", dpi: int = 150) -> List[Tuple[str, bytes]]:
        """Render each page of a PDF as high-resolution PNG or JPG bytes."""
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        output_images = []
        zoom = dpi / 72.0
        mat = pymupdf.Matrix(zoom, zoom)

        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=mat, alpha=(image_format.lower() == "png"))
            img_bytes = pix.tobytes(output=image_format.lower())
            output_images.append((f"page_{i + 1}.{image_format.lower()}", img_bytes))

        doc.close()
        return output_images

    @staticmethod
    def images_to_pdf(image_bytes_list: List[bytes]) -> bytes:
        """Combine multiple images (PNG/JPG/WEBP) into a single cohesive PDF."""
        doc = pymupdf.open()
        for img_bytes in image_bytes_list:
            img = Image.open(io.BytesIO(img_bytes))
            # Convert RGBA to RGB for standard PDF inclusion
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            img_data = buf.getvalue()
            
            img_doc = pymupdf.open(stream=img_data, filetype="jpeg")
            rect = img_doc[0].rect
            page = doc.new_page(width=rect.width, height=rect.height)
            page.insert_image(rect, stream=img_data)
            img_doc.close()

        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes

    @staticmethod
    def pdf_to_text(pdf_bytes: bytes) -> str:
        """Extract clean text content from all pages."""
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        text_parts = []
        for i, page in enumerate(doc):
            text_parts.append(f"--- Page {i + 1} ---\n" + page.get_text())
        doc.close()
        return "\n\n".join(text_parts)

    @staticmethod
    def pdf_to_markdown(pdf_bytes: bytes) -> str:
        """Extract structured Markdown with headings and paragraphs."""
        try:
            import pymupdf4llm
            return pymupdf4llm.to_markdown(pymupdf.open(stream=pdf_bytes, filetype="pdf"))
        except Exception:
            # Fallback text-based layout markdown generator
            doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
            lines = []
            for i, page in enumerate(doc):
                lines.append(f"## Page {i + 1}\n")
                blocks = page.get_text("blocks")
                for block in blocks:
                    text = block[4].strip()
                    if text:
                        if len(text) < 60 and not text.endswith("."):
                            lines.append(f"### {text}\n")
                        else:
                            lines.append(f"{text}\n\n")
            doc.close()
            return "".join(lines)

    @staticmethod
    def text_to_pdf(text_content: str) -> bytes:
        """Convert raw or formatted plain text into a formatted PDF document."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )
        styles = getSampleStyleSheet()
        normal_style = styles["Normal"]
        normal_style.fontSize = 10
        normal_style.leading = 14

        story = []
        for paragraph_str in text_content.split("\n\n"):
            clean_str = paragraph_str.strip().replace("\n", "<br/>")
            if clean_str:
                story.append(Paragraph(clean_str, normal_style))
                story.append(Spacer(1, 8))

        if not story:
            story.append(Paragraph("Empty document", normal_style))

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def pdf_to_docx(pdf_bytes: bytes) -> bytes:
        """
        Convert PDF to DOCX using pdf2docx or fallback text structure extraction.
        """
        import tempfile
        import os
        from pdf2docx import Converter

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as in_file:
            in_file.write(pdf_bytes)
            in_pdf_path = in_file.name

        out_docx_path = in_pdf_path.replace(".pdf", ".docx")

        try:
            cv = Converter(in_pdf_path)
            cv.convert(out_docx_path, start=0, end=None)
            cv.close()

            with open(out_docx_path, "rb") as f:
                docx_bytes = f.read()
            return docx_bytes
        except Exception as e:
            # Fallback converter using python-docx and text blocks
            doc = docx.Document()
            pdf_doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
            for page in pdf_doc:
                text = page.get_text()
                if text.strip():
                    doc.add_paragraph(text)
                doc.add_page_break()
            pdf_doc.close()
            out_buf = io.BytesIO()
            doc.save(out_buf)
            return out_buf.getvalue()
        finally:
            if os.path.exists(in_pdf_path):
                os.remove(in_pdf_path)
            if os.path.exists(out_docx_path):
                os.remove(out_docx_path)

    @staticmethod
    def docx_to_pdf(docx_bytes: bytes) -> bytes:
        """Convert DOCX file into clean PDF via paragraph and table parsing."""
        import html
        from reportlab.platypus import Table, TableStyle
        from reportlab.lib import colors

        doc = docx.Document(io.BytesIO(docx_bytes))
        buffer = io.BytesIO()
        pdf = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
        styles = getSampleStyleSheet()
        story = []

        for p in doc.paragraphs:
            raw_text = p.text.strip()
            if raw_text:
                safe_text = html.escape(raw_text).replace("\n", "<br/>")
                if p.style.name.startswith("Heading 1"):
                    story.append(Paragraph(safe_text, styles["Heading1"]))
                elif p.style.name.startswith("Heading 2"):
                    story.append(Paragraph(safe_text, styles["Heading2"]))
                elif p.style.name.startswith("Heading 3"):
                    story.append(Paragraph(safe_text, styles["Heading3"]))
                else:
                    story.append(Paragraph(safe_text, styles["Normal"]))
                story.append(Spacer(1, 6))

        # Also extract any tables in the DOCX
        for table in doc.tables:
            table_data = []
            for row in table.rows:
                row_data = []
                for cell in row.cells:
                    cell_text = html.escape(cell.text.strip()).replace("\n", "<br/>")
                    row_data.append(Paragraph(cell_text, styles["Normal"]))
                if any(row_data):
                    table_data.append(row_data)
            if table_data:
                t = Table(table_data)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ]))
                story.append(t)
                story.append(Spacer(1, 8))

        if not story:
            story.append(Paragraph("Empty DOCX document", styles["Normal"]))

        pdf.build(story)
        return buffer.getvalue()

    @staticmethod
    def pdf_to_excel(pdf_bytes: bytes) -> bytes:
        """Extract structured tables from PDF into an Excel workbook."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Extracted Tables"
        current_row = 1

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                if tables:
                    ws.cell(row=current_row, column=1, value=f"--- Page {page_idx + 1} ---")
                    current_row += 1
                    for table in tables:
                        for row in table:
                            for col_idx, cell_value in enumerate(row):
                                ws.cell(row=current_row, column=col_idx + 1, value=cell_value)
                            current_row += 1
                        current_row += 1  # Blank line between tables

        if current_row == 1:
            ws.cell(row=1, column=1, value="No tabular data detected in PDF.")

        out_buf = io.BytesIO()
        wb.save(out_buf)
        return out_buf.getvalue()

    @staticmethod
    def create_zip_archive(files: List[Tuple[str, bytes]]) -> bytes:
        """Create a standard ZIP archive from list of (filename, file_bytes)."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for filename, data in files:
                zf.writestr(filename, data)
        return zip_buffer.getvalue()
