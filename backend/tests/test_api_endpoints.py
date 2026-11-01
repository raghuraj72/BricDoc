import io
import uuid
import pytest
from fastapi.testclient import TestClient

def test_system_health(client: TestClient):
    res = client.get("/api/v1/admin/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "BricDoc API"

def test_auth_registration_and_login(client: TestClient):
    unique_email = f"user_{uuid.uuid4().hex[:8]}@bricdoc.com"
    password = "StrongPassword2026!"

    # 1. Register
    reg_res = client.post("/api/v1/auth/register", json={
        "email": unique_email,
        "password": password,
        "full_name": "Test Architect"
    })
    assert reg_res.status_code == 201
    token_data = reg_res.json()
    assert "access_token" in token_data
    assert token_data["email"] == unique_email

    # 2. Login
    login_res = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": password
    })
    assert login_res.status_code == 200
    auth_token = login_res.json()["access_token"]

    # 3. Access Protected /me
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == unique_email

    # 4. Access without token should be 401
    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401

def test_api_tool_merge(client: TestClient, sample_pdf_bytes):
    # Upload 2 files to /tools/merge
    files = [
        ("files", ("doc1.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")),
        ("files", ("doc2.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")),
    ]
    res = client.post("/api/v1/tools/merge", files=files)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > len(sample_pdf_bytes)

def test_api_tool_compress(client: TestClient, sample_pdf_bytes):
    files = {"file": ("doc.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")}
    data = {"level": "recommended"}
    res = client.post("/api/v1/tools/compress", files=files, data=data)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "X-Original-Size" in res.headers

def test_api_tool_watermark(client: TestClient, sample_pdf_bytes):
    files = {"file": ("doc.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")}
    data = {"text": "CONFIDENTIAL", "opacity": "0.3"}
    res = client.post("/api/v1/tools/watermark", files=files, data=data)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
