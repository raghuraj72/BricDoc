import os
import io
import time
import requests
from pypdf import PdfWriter, PdfReader
from docx import Document as DocxDocument
from PIL import Image

API_URL = "http://127.0.0.1:8005/api/v1"
HEALTH_URL = "http://127.0.0.1:8005/health"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://bricdoc-raghuraj.vercel.app")

def create_sample_pdf(text="Hello BricDoc Test PDF"):
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()

def test_system():
    print("=== STARTING FULL LIVE SYSTEM VERIFICATION ===")
    
    # 1. Health Checks
    print("\n[1/7] Testing Health Endpoints...")
    r = requests.get(HEALTH_URL)
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("  [PASS] Root Health: OK", r.json()["version"])

    r = requests.get(f"{API_URL}/admin/health")
    assert r.status_code == 200, f"Admin Health check failed: {r.text}"
    print("  [PASS] Admin Health: OK", r.json()["status"])

    # 2. Authentication & Profile
    print("\n[2/7] Testing User Authentication & Profile...")
    test_email = f"test_{int(time.time())}@bricdoc.com"
    r = requests.post(f"{API_URL}/auth/register", json={
        "email": test_email,
        "password": "SecurePassword123!",
        "full_name": "Test User"
    })
    assert r.status_code == 201, f"Registration failed: {r.text}"
    auth_data = r.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  [PASS] User Registration: OK")

    r = requests.post(f"{API_URL}/auth/login", json={
        "email": test_email,
        "password": "SecurePassword123!"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    print("  [PASS] User Login: OK")

    r = requests.get(f"{API_URL}/auth/me", headers=headers)
    assert r.status_code == 200 and r.json()["email"] == test_email
    print("  [PASS] User Profile Retrieval: OK")

    r = requests.put(f"{API_URL}/auth/profile", headers=headers, json={"full_name": "Updated User"})
    assert r.status_code == 200 and r.json()["full_name"] == "Updated User"
    print("  [PASS] User Profile Update: OK")

    # 3. Private Vault & Document Management
    print("\n[3/7] Testing Document Vault & Sharing...")
    pdf_bytes = create_sample_pdf()
    r = requests.post(
        f"{API_URL}/documents/upload",
        headers=headers,
        files={"file": ("vault_doc.pdf", pdf_bytes, "application/pdf")}
    )
    assert r.status_code == 201, f"Upload failed: {r.text}"
    doc_id = r.json()["id"]
    print("  [PASS] Document Upload: OK (id:", doc_id, ")")

    r = requests.get(f"{API_URL}/documents", headers=headers)
    assert r.status_code == 200 and len(r.json()) > 0
    print("  [PASS] Document Listing: OK")

    r = requests.post(f"{API_URL}/documents/share", headers=headers, json={"document_id": doc_id, "expires_in_hours": 24})
    assert r.status_code == 200
    share_token = r.json()["share_token"]
    print("  [PASS] Create Share Link: OK (token:", share_token, ")")

    r = requests.get(f"{API_URL}/documents/shared/{share_token}")
    if r.status_code != 200:
        print("Shared GET status:", r.status_code, "text:", r.text)
    assert r.status_code == 200
    print("  [PASS] Shared Document Access: OK")

    r = requests.post(f"{API_URL}/documents/{doc_id}/trash", headers=headers)
    assert r.status_code == 200 and "trash" in r.json().get("message", "").lower()
    print("  [PASS] Trash Document: OK")

    r = requests.post(f"{API_URL}/documents/{doc_id}/restore", headers=headers)
    assert r.status_code == 200 and "restored" in r.json().get("message", "").lower()
    print("  [PASS] Restore Document: OK")

    # 4. Document Processing Tools
    print("\n[4/7] Testing Core PDF Tools...")

    # Merge
    p1 = create_sample_pdf("Page 1")
    p2 = create_sample_pdf("Page 2")
    r = requests.post(f"{API_URL}/tools/merge", files=[
        ("files", ("p1.pdf", p1, "application/pdf")),
        ("files", ("p2.pdf", p2, "application/pdf"))
    ])
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    merged_pdf = r.content
    print("  [PASS] Merge PDF: OK (output:", len(merged_pdf), "bytes)")

    # Split
    r = requests.post(f"{API_URL}/tools/split", files={"file": ("merged.pdf", merged_pdf, "application/pdf")}, data={"ranges": "1"})
    assert r.status_code == 200
    print("  [PASS] Split PDF (ranges): OK")

    # Rotate
    r = requests.post(f"{API_URL}/tools/rotate", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"angle": "90"})
    assert r.status_code == 200
    print("  [PASS] Rotate PDF: OK")

    # Page Numbers
    r = requests.post(f"{API_URL}/tools/page-numbers", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"position": "bottom-center"})
    assert r.status_code == 200
    print("  [PASS] Page Numbers: OK")

    # Compress
    r = requests.post(f"{API_URL}/tools/compress", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"level": "recommended"})
    assert r.status_code == 200
    print("  [PASS] Compress PDF: OK")

    # Protect (AES-256)
    r = requests.post(f"{API_URL}/tools/protect", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"password": "TestPassword123!"})
    assert r.status_code == 200
    enc_pdf = r.content
    print("  [PASS] Protect PDF (AES-256): OK")

    # Unlock
    r = requests.post(f"{API_URL}/tools/unlock", files={"file": ("enc.pdf", enc_pdf, "application/pdf")}, data={"password": "TestPassword123!"})
    assert r.status_code == 200
    print("  [PASS] Unlock PDF: OK")

    # Watermark
    r = requests.post(f"{API_URL}/tools/watermark", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"text": "CONFIDENTIAL", "opacity": "0.3"})
    assert r.status_code == 200
    print("  [PASS] Watermark PDF: OK")

    # Redact
    import json
    redactions = json.dumps([{"page_number": 1, "x": 50, "y": 50, "width": 100, "height": 30}])
    r = requests.post(f"{API_URL}/tools/redact", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"redactions_json": redactions})
    assert r.status_code == 200
    print("  [PASS] Redact PDF: OK")

    # 5. Format Conversions
    print("\n[5/7] Testing Format Conversions...")
    # Word to PDF with real user doc if exists
    user_doc = r"C:\Users\RAGHURAJ P SINGH\Downloads\report__essay_writing.docx"
    if os.path.exists(user_doc):
        with open(user_doc, "rb") as f:
            docx_data = f.read()
    else:
        doc = DocxDocument()
        doc.add_heading("BricDoc Document", level=1)
        doc.add_paragraph("This is a verified test document.")
        s = io.BytesIO()
        doc.save(s)
        docx_data = s.getvalue()

    r = requests.post(f"{API_URL}/tools/convert/docx-to-pdf", files={"file": ("report.docx", docx_data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    print("  [PASS] Word to PDF: OK (output:", len(r.content), "bytes)")

    # PDF to Images
    r = requests.post(f"{API_URL}/tools/convert/pdf-to-images", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"format": "png"})
    assert r.status_code == 200 and "application/zip" in r.headers["content-type"]
    print("  [PASS] PDF to Images: OK")

    # Images to PDF
    img = Image.new("RGB", (200, 200), color="blue")
    img_io = io.BytesIO()
    img.save(img_io, format="PNG")
    r = requests.post(f"{API_URL}/tools/convert/images-to-pdf", files=[("files", ("test.png", img_io.getvalue(), "image/png"))])
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    print("  [PASS] Images to PDF: OK")

    # Text to PDF
    r = requests.post(f"{API_URL}/tools/convert/text-to-pdf", files={"file": ("notes.txt", b"Hello from BricDoc plain text conversion!", "text/plain")})
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    print("  [PASS] Text to PDF: OK")

    # PDF to Markdown
    r = requests.post(f"{API_URL}/tools/convert/pdf-to-markdown", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")})
    assert r.status_code == 200
    print("  [PASS] PDF to Markdown: OK")

    # 6. AI Intelligence & Workflows
    print("\n[6/7] Testing AI Intelligence & Multi-Step Workflows...")
    r = requests.post(f"{API_URL}/ai/summarize", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")})
    assert r.status_code == 200 and "summary" in r.json()
    print("  [PASS] AI Summarize: OK (provider:", r.json().get("provider"), ")")

    r = requests.post(f"{API_URL}/ai/chat", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")}, data={"message": "What is in this document?"})
    assert r.status_code == 200 and "answer" in r.json()
    print("  [PASS] AI Chat: OK")

    # Workflow creation & execution
    r = requests.post(f"{API_URL}/workflows", headers=headers, json={
        "name": "Audit & Watermark Flow",
        "description": "Multi-step automated pipeline",
        "steps": [
            {"order_index": 1, "tool_action": "watermark", "parameters_json": json.dumps({"text": "VERIFIED"})},
            {"order_index": 2, "tool_action": "compress", "parameters_json": json.dumps({"level": "recommended"})}
        ]
    })
    assert r.status_code == 201
    wf_id = r.json()["id"]
    print("  [PASS] Workflow Creation: OK (id:", wf_id, ")")

    r = requests.post(f"{API_URL}/workflows/{wf_id}/run", headers=headers, files=[("files", ("doc.pdf", pdf_bytes, "application/pdf"))])
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    print("  [PASS] Workflow Execution (Watermark -> Compress): OK (output:", len(r.content), "bytes)")

    # 7. Frontend Verification
    print(f"\n[7/7] Testing Frontend Pages on {FRONTEND_URL}...")
    routes_to_test = [
        "/",
        "/tools",
        "/tools/docx-to-pdf",
        "/tools/merge",
        "/tools/split",
        "/tools/compress",
        "/tools/protect",
        "/tools/editor",
        "/ai-assistant",
        "/workflows",
        "/dashboard",
        "/my-documents",
        "/pricing",
        "/about",
        "/security",
        "/privacy",
        "/terms",
        "/login",
        "/signup"
    ]
    for route in routes_to_test:
        res = requests.get(f"{FRONTEND_URL}{route}")
        assert res.status_code == 200, f"Route {route} failed with status {res.status_code}"
    print(f"  [PASS] All {len(routes_to_test)} Frontend Pages: HTTP 200 OK")

    print("\n=======================================================")
    print(">>> ALL 7 SYSTEM DOMAINS PASSED FULL LIVE VERIFICATION! <<<")
    print("=======================================================\n")

if __name__ == "__main__":
    test_system()
