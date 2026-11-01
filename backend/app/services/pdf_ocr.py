import io
import shutil
from typing import Dict, Any, List
import pymupdf

class PDFOCRService:
    """
    Intelligent document processing and OCR service.
    Detects scanned pages, extracts text with bounding boxes,
    and analyzes document structure.
    """

    @staticmethod
    def is_tesseract_available() -> bool:
        """Check if Tesseract binary is available on system PATH."""
        return shutil.which("tesseract") is not None

    @staticmethod
    def inspect_document(pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Inspect PDF structure to detect whether it is digitally authored or a scanned raster.
        Calculates page count, text density, image presence, and character count.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        total_chars = 0
        total_images = 0
        scanned_pages_count = 0
        pages_summary = []

        for i, page in enumerate(doc):
            text = page.get_text()
            char_count = len(text.strip())
            images = page.get_images()
            img_count = len(images)
            
            total_chars += char_count
            total_images += img_count
            
            # If a page has images and fewer than 50 characters, it is very likely scanned
            is_scanned = (img_count > 0 and char_count < 50)
            if is_scanned:
                scanned_pages_count += 1
                
            pages_summary.append({
                "page": i + 1,
                "character_count": char_count,
                "image_count": img_count,
                "is_scanned": is_scanned
            })

        is_mostly_scanned = total_pages > 0 and (scanned_pages_count / total_pages) >= 0.5

        result = {
            "total_pages": total_pages,
            "total_characters": total_chars,
            "total_images": total_images,
            "is_scanned": is_mostly_scanned,
            "ocr_engine_available": PDFOCRService.is_tesseract_available(),
            "pages": pages_summary
        }
        doc.close()
        return result

    @staticmethod
    def extract_structured_text(pdf_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extract text organized by blocks and headings with structural metadata.
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        structured_data = []

        for i, page in enumerate(doc):
            blocks = page.get_text("blocks")
            page_blocks = []
            for b in blocks:
                text = b[4].strip()
                if text:
                    page_blocks.append({
                        "bbox": [b[0], b[1], b[2], b[3]],
                        "text": text,
                        "type": "heading" if len(text) < 60 and not text.endswith(".") else "paragraph"
                    })
            structured_data.append({
                "page": i + 1,
                "blocks": page_blocks
            })

        doc.close()
        return structured_data
