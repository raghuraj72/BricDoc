import io
import pypdf
import pytest
from app.services.pdf_converter import PDFConverter

def test_images_to_pdf_and_back(sample_image_bytes):
    # Convert image to PDF
    pdf_bytes = PDFConverter.images_to_pdf([sample_image_bytes, sample_image_bytes])
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 2

    # Convert PDF to images
    images = PDFConverter.pdf_to_images(pdf_bytes, image_format="png")
    assert len(images) == 2
    assert images[0][0] == "page_1.png"
    assert len(images[0][1]) > 0

def test_text_to_pdf_and_back():
    sample_text = "BricDoc Document Processing Platform.\n\nTesting conversion accuracy and formatting."
    pdf_bytes = PDFConverter.text_to_pdf(sample_text)
    assert len(pdf_bytes) > 0
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) >= 1

    extracted_text = PDFConverter.pdf_to_text(pdf_bytes)
    assert "BricDoc Document Processing Platform" in extracted_text

def test_pdf_to_markdown(sample_pdf_bytes):
    md = PDFConverter.pdf_to_markdown(sample_pdf_bytes)
    assert len(md) > 0
    assert "BricDoc" in md

def test_create_zip_archive():
    files = [("test1.txt", b"Hello 1"), ("test2.txt", b"Hello 2")]
    zip_bytes = PDFConverter.create_zip_archive(files)
    assert len(zip_bytes) > 0
