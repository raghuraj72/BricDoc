import io
import pypdf
import pytest
from app.services.pdf_security import PDFSecurity

def test_protect_and_unlock_pdf(sample_pdf_bytes):
    password = "BricDocSecurePassword2026!"
    encrypted = PDFSecurity.protect_pdf(sample_pdf_bytes, user_password=password)
    
    # Verify it is encrypted
    reader = pypdf.PdfReader(io.BytesIO(encrypted))
    assert reader.is_encrypted

    # Unlock with password
    unlocked = PDFSecurity.unlock_pdf(encrypted, password=password)
    unlocked_reader = pypdf.PdfReader(io.BytesIO(unlocked))
    assert not unlocked_reader.is_encrypted
    assert len(unlocked_reader.pages) == 2

def test_watermark_pdf(sample_pdf_bytes):
    watermarked = PDFSecurity.add_watermark(sample_pdf_bytes, text="CONFIDENTIAL", opacity=0.4)
    reader = pypdf.PdfReader(io.BytesIO(watermarked))
    assert len(reader.pages) == 2
    # Check watermark text is embedded
    text = reader.pages[0].extract_text()
    assert "CONFIDENTIAL" in text

def test_redact_pdf(sample_pdf_bytes):
    # Redact box on page 1 covering the greeting
    redacted = PDFSecurity.redact_pdf(sample_pdf_bytes, [
        {"page_number": 1, "x": 90, "y": 80, "width": 300, "height": 30}
    ])
    assert len(redacted) > 0
    reader = pypdf.PdfReader(io.BytesIO(redacted))
    assert len(reader.pages) == 2
