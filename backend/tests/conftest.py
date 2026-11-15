import io
import pytest
from reportlab.pdfgen import canvas
from fastapi.testclient import TestClient

from app.core.database import Base, engine, SessionLocal
from app.models.user import DailyUsage
from app.main import app

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield

@pytest.fixture(autouse=True)
def reset_daily_usage_for_tests():
    """Resets daily rate limiter usage for test runner to prevent 429 during tests."""
    db = SessionLocal()
    try:
        db.query(DailyUsage).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def sample_pdf_bytes():
    """Generates a real 2-page PDF in memory for testing."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792))
    c.drawString(100, 700, "BricDoc Test Page 1: Hello World")
    c.drawString(100, 680, "This is a sample document for automated verification.")
    c.showPage()
    c.drawString(100, 700, "BricDoc Test Page 2: Testing Document Intelligence")
    c.drawString(100, 680, "Second page content for splitting and merging.")
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()

@pytest.fixture
def sample_image_bytes():
    """Generates a real 100x100 PNG image in memory for testing."""
    from PIL import Image
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color="blue")
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()
