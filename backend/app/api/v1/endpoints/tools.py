import io
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import storage
from app.api.v1.endpoints.auth import get_current_user_optional
from app.models.user import User
from app.services.pdf_processor import PDFProcessor
from app.services.pdf_converter import PDFConverter
from app.services.pdf_security import PDFSecurity
from app.services.pdf_ocr import PDFOCRService
from app.services.pdf_utilities import PDFUtilities
from app.services.usage_limiter import UsageLimiter

def enforce_daily_usage_limit(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    UsageLimiter.check_and_increment(request=request, db=db, user=current_user, file_count=1)

router = APIRouter(dependencies=[Depends(enforce_daily_usage_limit)])

def _save_or_return(
    data: bytes,
    filename: str,
    media_type: str,
    user: Optional[User],
    db: Session
):
    """
    Returns direct file stream download with proper content disposition headers.
    """
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(data))
        }
    )

# ----------------- A. ORGANIZE PDF -----------------

@router.post("/merge")
async def merge_pdfs(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Merge 2 or more PDF documents in specified order."""
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least two PDF files are required to merge.")

    byte_streams = []
    for f in files:
        data = await f.read()
        byte_streams.append(data)

    try:
        merged_bytes = PDFProcessor.merge_pdfs(byte_streams)
        return _save_or_return(merged_bytes, "bricdoc_merged.pdf", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Merge error: {str(e)}")

@router.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    ranges: Optional[str] = Form(None),
    split_all: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Split PDF by page range (e.g. '1-3, 5') or into a ZIP archive of individual pages."""
    pdf_bytes = await file.read()
    try:
        if ranges:
            out_bytes = PDFProcessor.split_pdf(pdf_bytes, range_str=ranges)
            return _save_or_return(out_bytes, f"split_{file.filename}", "application/pdf", current_user, db)
        else:
            pages = PDFProcessor.split_pdf(pdf_bytes, range_str=None)
            zip_bytes = PDFConverter.create_zip_archive(pages)
            return _save_or_return(zip_bytes, f"pages_{file.filename}.zip", "application/zip", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Split error: {str(e)}")

@router.post("/rotate")
async def rotate_pdf(
    file: UploadFile = File(...),
    angle: int = Form(90),
    page_numbers: Optional[str] = Form(None),  # Comma-separated
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Rotate PDF pages by 90, 180, or 270 degrees."""
    pdf_bytes = await file.read()
    pages_list = None
    if page_numbers:
        try:
            pages_list = [int(p.strip()) for p in page_numbers.split(",") if p.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid page numbers format.")

    try:
        out_bytes = PDFProcessor.rotate_pages(pdf_bytes, angle=angle, page_numbers=pages_list)
        return _save_or_return(out_bytes, f"rotated_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Rotation error: {str(e)}")

@router.post("/page-numbers")
async def add_page_numbers(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    start_number: int = Form(1),
    font_size: int = Form(10),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Add professional page numbering with customizable position and font."""
    pdf_bytes = await file.read()
    try:
        out_bytes = PDFProcessor.add_page_numbers(
            pdf_bytes,
            position=position,
            start_number=start_number,
            font_size=font_size
        )
        return _save_or_return(out_bytes, f"numbered_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Page numbering error: {str(e)}")

@router.post("/crop")
async def crop_pdf(
    file: UploadFile = File(...),
    margin_points: float = Form(36.0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Crop PDF page margins."""
    pdf_bytes = await file.read()
    try:
        out_bytes = PDFProcessor.crop_pages(pdf_bytes, margin_points=margin_points)
        return _save_or_return(out_bytes, f"cropped_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Crop error: {str(e)}")

# ----------------- B. OPTIMIZE PDF -----------------

@router.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("recommended"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Compress PDF streams and optimize images with real size reduction calculation."""
    pdf_bytes = await file.read()
    orig_size = len(pdf_bytes)
    try:
        compressed_bytes = PDFProcessor.compress_pdf(pdf_bytes, level=level)
        new_size = len(compressed_bytes)
        reduction = round(((orig_size - new_size) / orig_size) * 100, 1) if orig_size > 0 else 0
        
        response = _save_or_return(compressed_bytes, f"compressed_{file.filename}", "application/pdf", current_user, db)
        response.headers["X-Original-Size"] = str(orig_size)
        response.headers["X-Compressed-Size"] = str(new_size)
        response.headers["X-Reduction-Percentage"] = str(reduction)
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Compression error: {str(e)}")

# ----------------- C. CONVERT PDF -----------------

@router.post("/convert/pdf-to-docx")
async def convert_pdf_to_docx(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Convert PDF to editable DOCX format."""
    pdf_bytes = await file.read()
    try:
        docx_bytes = PDFConverter.pdf_to_docx(pdf_bytes)
        out_name = f"{file.filename.rsplit('.', 1)[0]}.docx"
        return _save_or_return(docx_bytes, out_name, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Conversion error: {str(e)}")

@router.post("/convert/docx-to-pdf")
async def convert_docx_to_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Convert DOCX file to clean PDF."""
    docx_bytes = await file.read()
    try:
        pdf_bytes = PDFConverter.docx_to_pdf(docx_bytes)
        out_name = f"{file.filename.rsplit('.', 1)[0]}.pdf"
        return _save_or_return(pdf_bytes, out_name, "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Conversion error: {str(e)}")

@router.post("/convert/pdf-to-images")
async def convert_pdf_to_images(
    file: UploadFile = File(...),
    image_format: str = Form("png"),
    dpi: int = Form(150),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Convert PDF pages to image archive (ZIP)."""
    pdf_bytes = await file.read()
    try:
        images = PDFConverter.pdf_to_images(pdf_bytes, image_format=image_format, dpi=dpi)
        zip_bytes = PDFConverter.create_zip_archive(images)
        out_name = f"{file.filename.rsplit('.', 1)[0]}_images.zip"
        return _save_or_return(zip_bytes, out_name, "application/zip", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image conversion error: {str(e)}")

@router.post("/convert/images-to-pdf")
async def convert_images_to_pdf(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Convert one or more images into a single cohesive PDF."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one image is required.")
    
    img_bytes_list = []
    for f in files:
        data = await f.read()
        img_bytes_list.append(data)

    try:
        pdf_bytes = PDFConverter.images_to_pdf(img_bytes_list)
        return _save_or_return(pdf_bytes, "converted_images.pdf", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Images to PDF error: {str(e)}")

@router.post("/convert/pdf-to-excel")
async def convert_pdf_to_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Extract tables from PDF into an Excel spreadsheet."""
    pdf_bytes = await file.read()
    try:
        excel_bytes = PDFConverter.pdf_to_excel(pdf_bytes)
        out_name = f"{file.filename.rsplit('.', 1)[0]}.xlsx"
        return _save_or_return(excel_bytes, out_name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Table extraction error: {str(e)}")

@router.post("/convert/text-to-pdf")
async def convert_text_to_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Convert text or markdown file to PDF."""
    content = (await file.read()).decode("utf-8", errors="replace")
    try:
        pdf_bytes = PDFConverter.text_to_pdf(content)
        out_name = f"{file.filename.rsplit('.', 1)[0]}.pdf"
        return _save_or_return(pdf_bytes, out_name, "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Text to PDF error: {str(e)}")

@router.post("/convert/pdf-to-markdown")
async def convert_pdf_to_markdown(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Extract structured Markdown from PDF."""
    pdf_bytes = await file.read()
    try:
        md_text = PDFConverter.pdf_to_markdown(pdf_bytes)
        out_name = f"{file.filename.rsplit('.', 1)[0]}.md"
        return _save_or_return(md_text.encode("utf-8"), out_name, "text/markdown", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Markdown extraction error: {str(e)}")

# ----------------- D. SECURITY & REDACTION -----------------

@router.post("/protect")
async def protect_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Encrypt PDF using AES-256 standard encryption."""
    pdf_bytes = await file.read()
    try:
        encrypted_bytes = PDFSecurity.protect_pdf(pdf_bytes, user_password=password)
        return _save_or_return(encrypted_bytes, f"protected_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Encryption error: {str(e)}")

@router.post("/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Decrypt password-protected PDF."""
    pdf_bytes = await file.read()
    try:
        unlocked_bytes = PDFSecurity.unlock_pdf(pdf_bytes, password=password)
        return _save_or_return(unlocked_bytes, f"unlocked_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption error: {str(e)}")

@router.post("/watermark")
async def watermark_pdf(
    file: UploadFile = File(...),
    text: str = Form(...),
    opacity: float = Form(0.3),
    font_size: int = Form(48),
    rotation: int = Form(45),
    color: str = Form("#6b7280"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Add professional text watermark across all pages."""
    pdf_bytes = await file.read()
    try:
        wm_bytes = PDFSecurity.add_watermark(
            pdf_bytes,
            text=text,
            opacity=opacity,
            font_size=font_size,
            rotation=rotation,
            color_hex=color
        )
        return _save_or_return(wm_bytes, f"watermarked_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Watermark error: {str(e)}")

@router.post("/redact")
async def redact_pdf(
    file: UploadFile = File(...),
    redactions_json: str = Form(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Permanently and irreversibly redact content boxes from PDF."""
    pdf_bytes = await file.read()
    try:
        boxes = json.loads(redactions_json)
        redacted_bytes = PDFSecurity.redact_pdf(pdf_bytes, boxes)
        return _save_or_return(redacted_bytes, f"redacted_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Redaction error: {str(e)}")

# ----------------- E. UTILITIES & INSPECTION -----------------

@router.post("/compare")
async def compare_documents(
    file1: Optional[UploadFile] = File(None),
    file2: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db)
):
    """Compare two PDFs and return detailed textual difference analysis."""
    f1 = file1 or (files[0] if files and len(files) > 0 else None)
    f2 = file2 or (files[1] if files and len(files) > 1 else f1)
    if not f1 or not f2:
        raise HTTPException(status_code=400, detail="Two PDF files are required for comparison.")
    bytes1 = await f1.read()
    bytes2 = await f2.read()
    try:
        diff_result = PDFUtilities.compare_pdfs(bytes1, bytes2)
        return diff_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Comparison error: {str(e)}")

@router.post("/repair")
async def repair_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Attempt reconstruction of malformed xref and corrupted streams."""
    pdf_bytes = await file.read()
    try:
        repaired_bytes = PDFUtilities.repair_pdf(pdf_bytes)
        return _save_or_return(repaired_bytes, f"repaired_{file.filename}", "application/pdf", current_user, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Repair failed: {str(e)}")

@router.post("/inspect-ocr")
async def inspect_document_ocr(file: UploadFile = File(...)):
    """Analyze PDF structure to detect whether it is digitally authored or scanned raster."""
    pdf_bytes = await file.read()
    try:
        return PDFOCRService.inspect_document(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Inspection error: {str(e)}")
