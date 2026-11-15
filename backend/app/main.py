import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine, Base, sync_schema_migrations
from app.api.v1.api import api_router
from app.api.v1.endpoints import payments, subscription
import app.models  # Ensure all models are registered

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bricdoc")

# Create tables and sync schema migrations
Base.metadata.create_all(bind=engine)
try:
    sync_schema_migrations()
except Exception as e:
    logger.warning(f"Schema migration sync check skipped or warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan Context Manager.
    Manages in-process background worker lifecycle for zero-paid hosting architectures.
    """
    worker_task = None
    if settings.ENABLE_INPROCESS_WORKER:
        from app.worker import run_inprocess_worker, stop_inprocess_worker
        worker_task = asyncio.create_task(run_inprocess_worker())
        logger.info("FastAPI Lifespan: In-process background worker task launched.")

    yield

    if worker_task:
        from app.worker import stop_inprocess_worker
        stop_inprocess_worker()
        try:
            await asyncio.wait_for(worker_task, timeout=5.0)
        except Exception:
            pass
        logger.info("FastAPI Lifespan: In-process background worker task terminated gracefully.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade all-in-one document productivity platform API.",
    openapi_url="/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
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
