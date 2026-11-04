import io
import difflib
from typing import Dict, Any, List, Tuple
import pymupdf
import pypdf

class PDFUtilities:
    """
    Utility operations: comparison, repair, image extraction, metadata editing, and form filling.
    """

    @staticmethod
    def compare_pdfs(pdf_bytes_1: bytes, pdf_bytes_2: bytes) -> Dict[str, Any]:
        """
        Compare two PDFs page-by-page and compute unified textual differences.
        """
        doc1 = pymupdf.open(stream=pdf_bytes_1, filetype="pdf")
        doc2 = pymupdf.open(stream=pdf_bytes_2, filetype="pdf")

        max_pages = max(len(doc1), len(doc2))
        page_comparisons = []
        total_additions = 0
        total_deletions = 0

        for idx in range(max_pages):
            text1 = doc1[idx].get_text() if idx < len(doc1) else ""
            text2 = doc2[idx].get_text() if idx < len(doc2) else ""

            lines1 = text1.splitlines()
            lines2 = text2.splitlines()

            matcher = difflib.SequenceMatcher(None, lines1, lines2)
            diff = list(difflib.unified_diff(lines1, lines2, lineterm=""))

            adds = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
            dels = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))
            total_additions += adds
            total_deletions += dels

            similarity = matcher.ratio()

            page_comparisons.append({
                "page": idx + 1,
                "similarity_score": round(similarity * 100, 1),
                "additions": adds,
                "deletions": dels,
                "diff_summary": diff[:20]  # First 20 lines of diff
            })

        len1 = len(doc1)
        len2 = len(doc2)
        doc1.close()
        doc2.close()

        return {
            "total_pages_doc1": len1,
            "total_pages_doc2": len2,
            "total_additions": total_additions,
            "total_deletions": total_deletions,
            "pages": page_comparisons
        }

    @staticmethod
    def repair_pdf(pdf_bytes: bytes) -> bytes:
        """
        Attempt to repair corrupted or malformed PDF streams and xref tables.
        """
        try:
            # First attempt: PyMuPDF xref rebuild and clean
            doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
            out_bytes = doc.tobytes(garbage=4, clean=True, deflate=True)
            doc.close()
            return out_bytes
        except Exception:
            # Second attempt: pypdf non-strict parser reconstruction
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes), strict=False)
            writer = pypdf.PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            buf = io.BytesIO()
            writer.write(buf)
            return buf.getvalue()

    @staticmethod
    def extract_images(pdf_bytes: bytes) -> List[Tuple[str, bytes]]:
        """Extract all embedded images from the PDF."""
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        extracted = []
        image_idx = 1

        for page_idx, page in enumerate(doc):
            image_list = page.get_images(full=True)
            for img in image_list:
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                extracted.append((f"img_p{page_idx + 1}_{image_idx}.{image_ext}", image_bytes))
                image_idx += 1

        doc.close()
        return extracted

    @staticmethod
    def get_metadata(pdf_bytes: bytes) -> Dict[str, Any]:
        """Read document metadata."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        meta = reader.metadata or {}
        return {
            "title": meta.get("/Title", "") or "",
            "author": meta.get("/Author", "") or "",
            "subject": meta.get("/Subject", "") or "",
            "creator": meta.get("/Creator", "") or "",
            "producer": meta.get("/Producer", "") or "",
            "creation_date": str(meta.get("/CreationDate", "") or ""),
            "page_count": len(reader.pages)
        }

    @staticmethod
    def edit_metadata(pdf_bytes: bytes, metadata_updates: Dict[str, str]) -> bytes:
        """Update document metadata fields."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        formatted_meta = {}
        if "title" in metadata_updates:
            formatted_meta["/Title"] = metadata_updates["title"]
        if "author" in metadata_updates:
            formatted_meta["/Author"] = metadata_updates["author"]
        if "subject" in metadata_updates:
            formatted_meta["/Subject"] = metadata_updates["subject"]
        if "creator" in metadata_updates:
            formatted_meta["/Creator"] = metadata_updates["creator"]

        writer.add_metadata(formatted_meta)
        buf = io.BytesIO()
        writer.write(buf)
        return buf.getvalue()

    @staticmethod
    def inspect_form_fields(pdf_bytes: bytes) -> Dict[str, Any]:
        """List fillable form fields and current values."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        fields = reader.get_fields() or {}
        field_list = []
        for name, data in fields.items():
            field_list.append({
                "name": name,
                "type": str(data.get("/FT", "")),
                "value": str(data.get("/V", ""))
            })
        return {"fields": field_list}

    @staticmethod
    def fill_form_fields(pdf_bytes: bytes, field_values: Dict[str, Any]) -> bytes:
        """Fill form fields in a fillable PDF document."""
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        writer = pypdf.PdfWriter()
        writer.append(reader)
        writer.update_page_form_field_values(writer.pages[0], field_values)
        buf = io.BytesIO()
        writer.write(buf)
        return buf.getvalue()
