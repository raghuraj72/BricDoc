import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Folder(Base):
    __tablename__ = "folders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(255), nullable=False)
    color = Column(String(32), default="#4f46e5")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="folders")
    parent = relationship("Folder", remote_side=[id], backref="subfolders")
    documents = relationship("Document", back_populates="folder")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(String(36), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)
    
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    file_type = Column(String(32), default="pdf")  # pdf, docx, image, etc.
    mime_type = Column(String(128), default="application/pdf")
    file_size_bytes = Column(Integer, nullable=False)
    sha256_hash = Column(String(64), index=True, nullable=True)
    page_count = Column(Integer, default=1)
    
    is_favorite = Column(Boolean, default=False)
    is_trashed = Column(Boolean, default=False)
    trashed_at = Column(DateTime, nullable=True)
    
    thumbnail_path = Column(String(512), nullable=True)
    extracted_text_preview = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="documents")
    folder = relationship("Folder", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    tags = relationship("DocumentTag", back_populates="document", cascade="all, delete-orphan")
    shares = relationship("DocumentShare", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    storage_path = Column(String(512), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    change_summary = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="versions")


class DocumentTag(Base):
    __tablename__ = "document_tags"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_name = Column(String(64), nullable=False)
    color = Column(String(32), default="#6366f1")

    document = relationship("Document", back_populates="tags")


class DocumentShare(Base):
    __tablename__ = "document_shares"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    share_token = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    allow_download = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="shares")
