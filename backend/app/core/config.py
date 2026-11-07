import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "BricDoc API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    APP_URL: str = os.getenv("APP_URL", "https://bricdoc-raghuraj.vercel.app")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "bricdoc-super-secure-production-ready-jwt-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8005",
        "http://127.0.0.1:8005",
        "capacitor://localhost",
        "https://localhost",
    ] + [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/bricdoc.db")
    
    # File Storage
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", str(BASE_DIR / "vault_storage"))
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))
    
    # AI Provider (Google Gemini)
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    DEFAULT_GEMINI_MODEL: str = os.getenv("DEFAULT_GEMINI_MODEL", "gemini-2.5-flash")
    
    # Razorpay Payment Gateway Configuration
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = os.getenv("RAZORPAY_WEBHOOK_SECRET", None)
    RAZORPAY_MODE: str = os.getenv("RAZORPAY_MODE", "test")  # "test" or "live"
    
    # Stripe (Optional secondary international gateway)
    STRIPE_PUBLIC_KEY: Optional[str] = os.getenv("STRIPE_PUBLIC_KEY", None)
    STRIPE_SECRET_KEY: Optional[str] = os.getenv("STRIPE_SECRET_KEY", None)
    
    # Company / Invoice Configuration
    COMPANY_NAME: str = os.getenv("COMPANY_NAME", "BricDoc Technologies Private Limited")
    COMPANY_EMAIL: str = os.getenv("COMPANY_EMAIL", "billing@bricdoc.com")
    COMPANY_ADDRESS: str = os.getenv("COMPANY_ADDRESS", "Bengaluru, Karnataka, 560001, India")
    COMPANY_GSTIN: Optional[str] = os.getenv("COMPANY_GSTIN", None)
    TAX_RATE_PERCENT: float = float(os.getenv("TAX_RATE_PERCENT", "18.0"))  # 18% GST (CGST 9% + SGST 9%)
    
    # Background Processing & Concurrency
    MAX_WORKER_CONCURRENCY: int = 4
    JOB_TIMEOUT_SECONDS: int = 300
    
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure all critical storage directories exist
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "documents"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "temp"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "invoices"), exist_ok=True)
