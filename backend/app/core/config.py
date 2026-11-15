import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "BricDoc API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    API_V1_STR: str = "/api/v1"
    APP_URL: str = os.getenv("APP_URL", "https://bricdoc-raghuraj.vercel.app")
    
    @property
    def is_production(self) -> bool:
        """Determines whether running in production environment."""
        return self.ENVIRONMENT.lower() == "production"

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
    
    # Database (SQLite in local dev, Neon/Supabase PostgreSQL in production)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/bricdoc.db")
    
    # Redis / Key-Value Cache & Queue (Optional; if unset, database-backed queue is used)
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", None)
    
    # File Storage (Local ephemeral scratchpad or S3/Cloudflare R2 Object Storage)
    STORAGE_DIR: str = os.getenv(
        "STORAGE_DIR",
        "/tmp/vault_storage" if (os.name != "nt" and os.getenv("ENVIRONMENT", "").lower() == "production") else str(BASE_DIR / "vault_storage")
    )
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
    MAX_CONCURRENT_JOBS: int = int(os.getenv("MAX_CONCURRENT_JOBS", "1"))
    ENABLE_INPROCESS_WORKER: bool = os.getenv("ENABLE_INPROCESS_WORKER", "true").lower() in ("true", "1", "yes")
    
    # Cloudflare R2 / AWS S3 Object Storage Credentials
    R2_ACCOUNT_ID: Optional[str] = os.getenv("R2_ACCOUNT_ID", None)
    R2_ACCESS_KEY_ID: Optional[str] = os.getenv("R2_ACCESS_KEY_ID", None)
    R2_SECRET_ACCESS_KEY: Optional[str] = os.getenv("R2_SECRET_ACCESS_KEY", None)
    R2_BUCKET_NAME: Optional[str] = os.getenv("R2_BUCKET_NAME", None)
    R2_ENDPOINT_URL: Optional[str] = os.getenv("R2_ENDPOINT_URL", None)

    @property
    def r2_configured(self) -> bool:
        """Checks if Cloudflare R2 credentials and bucket are fully configured."""
        return bool(
            self.R2_ACCESS_KEY_ID
            and self.R2_SECRET_ACCESS_KEY
            and self.R2_BUCKET_NAME
            and (self.R2_ENDPOINT_URL or self.R2_ACCOUNT_ID)
        )

    def get_r2_endpoint(self) -> Optional[str]:
        """Resolves the S3 endpoint URL for Cloudflare R2."""
        if self.R2_ENDPOINT_URL and self.R2_ENDPOINT_URL.strip():
            return self.R2_ENDPOINT_URL.strip()
        if self.R2_ACCOUNT_ID and self.R2_ACCOUNT_ID.strip():
            return f"https://{self.R2_ACCOUNT_ID.strip()}.r2.cloudflarestorage.com"
        return None
    
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
    MAX_WORKER_CONCURRENCY: int = 1
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
