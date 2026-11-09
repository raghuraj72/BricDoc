import logging
import shutil
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.api import api_router
from app.api.v1.endpoints import payments, subscription
import app.models  # Ensure all models are registered

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bricdoc")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade all-in-one document productivity platform API.",
    openapi_url="/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"^https://(.*\.vercel\.app|.*\.bricdoc\.in|bricdoc\.in|.*\.onrender\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."}
    )

# Mount API V1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# Direct aliases for standard API patterns
app.include_router(payments.router, prefix="/api/payments", tags=["Payment Aliases"])
app.include_router(subscription.router, prefix="/api/subscriptions", tags=["Subscription Aliases"])

@app.get("/health")
def root_health():
    from app.api.v1.api import api_v1_health
    return api_v1_health()

@app.get("/")
def root():
    return {
        "message": "Welcome to BricDoc API — Everything your documents need. One intelligent workspace.",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": "/health"
    }
