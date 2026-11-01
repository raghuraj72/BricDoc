from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    documents,
    tools,
    editor,
    ai,
    workflows,
    jobs,
    admin
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents & Vault"])
api_router.include_router(tools.router, prefix="/tools", tags=["PDF Tools"])
api_router.include_router(editor.router, prefix="/editor", tags=["Document Editor"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Document Intelligence"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Custom Workflows"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Background Jobs"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration & Health"])
