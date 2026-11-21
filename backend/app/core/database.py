from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Normalize DATABASE_URL (Railway, Render, Supabase provide postgres:// which SQLAlchemy 2.0 requires as postgresql://)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Connection arguments and engine configuration
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # Production PostgreSQL pool settings (optimized for serverless Neon pooler)
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_timeout"] = 30

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def sync_schema_migrations():
    """
    Safely synchronizes table schemas, ensuring newly added columns
    (such as ProcessingJob.parameters) exist without manual downtime.
    """
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "processing_jobs" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("processing_jobs")]
        if "parameters" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE processing_jobs ADD COLUMN parameters TEXT;"))
                conn.commit()

def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a clean SQLAlchemy database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
