import io
import pypdf
import pytest
from app.services.pdf_processor import PDFProcessor

def test_merge_pdfs(sample_pdf_bytes):
    # Merge 2 copies of 2-page PDF -> 4 pages
    merged = PDFProcessor.merge_pdfs([sample_pdf_bytes, sample_pdf_bytes])
    reader = pypdf.PdfReader(io.BytesIO(merged))
    assert len(reader.pages) == 4

def test_split_pdf_by_range(sample_pdf_bytes):
    # Extract page 1
    split_bytes = PDFProcessor.split_pdf(sample_pdf_bytes, range_str="1")
    assert isinstance(split_bytes, bytes)
    reader = pypdf.PdfReader(io.BytesIO(split_bytes))
    assert len(reader.pages) == 1

def test_split_pdf_all_pages(sample_pdf_bytes):
    # Split into individual pages
    pages = PDFProcessor.split_pdf(sample_pdf_bytes, range_str=None)
    assert len(pages) == 2
    assert pages[0][0] == "page_1.pdf"
    assert pages[1][0] == "page_2.pdf"

def test_rotate_pages(sample_pdf_bytes):
    rotated = PDFProcessor.rotate_pages(sample_pdf_bytes, angle=90, page_numbers=[1])
    reader = pypdf.PdfReader(io.BytesIO(rotated))
    assert len(reader.pages) == 2
    # Verify first page is rotated
    assert reader.pages[0].rotation == 90

def test_add_page_numbers(sample_pdf_bytes):
    numbered = PDFProcessor.add_page_numbers(sample_pdf_bytes, position="bottom-center")
    reader = pypdf.PdfReader(io.BytesIO(numbered))
    assert len(reader.pages) == 2
    # Check that text was merged
    text = reader.pages[0].extract_text()
    assert "Page 1 of 2" in text

def test_compress_pdf(sample_pdf_bytes):
    compressed = PDFProcessor.compress_pdf(sample_pdf_bytes, level="recommended")
    assert len(compressed) > 0
    reader = pypdf.PdfReader(io.BytesIO(compressed))
    assert len(reader.pages) == 2

def test_crop_pages(sample_pdf_bytes):
    cropped = PDFProcessor.crop_pages(sample_pdf_bytes, margin_points=18.0)
    reader = pypdf.PdfReader(io.BytesIO(cropped))
    assert len(reader.pages) == 2
