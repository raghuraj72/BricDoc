from typing import List, Optional
from pydantic import BaseModel, Field

class MergeOptions(BaseModel):
    document_ids: Optional[List[str]] = None

class SplitOptions(BaseModel):
    ranges: Optional[str] = Field(None, description="Comma-separated ranges e.g. '1-3, 5, 7-9'")
    split_all: bool = False

class RotateOptions(BaseModel):
    angle: int = Field(90, description="Angle in degrees (90, 180, 270)")
    page_numbers: Optional[List[int]] = Field(None, description="1-based page numbers to rotate. None rotates all pages.")

class PageNumbersOptions(BaseModel):
    position: str = Field("bottom-center", description="bottom-left, bottom-center, bottom-right, top-left, top-center, top-right")
    start_number: int = 1
    font_size: int = 10
    margin: int = 36

class CompressOptions(BaseModel):
    level: str = Field("recommended", description="extreme, recommended, low")

class ProtectOptions(BaseModel):
    password: str = Field(..., min_length=1)

class UnlockOptions(BaseModel):
    password: str = Field(...)

class WatermarkOptions(BaseModel):
    text: str = Field(...)
    opacity: float = Field(0.3, ge=0.05, le=1.0)
    font_size: int = Field(48, ge=12, le=144)
    rotation: int = Field(45, description="Rotation angle in degrees")
    color: str = Field("#6b7280", description="Hex color")

class RedactionItem(BaseModel):
    page_number: int = Field(..., description="1-based page number")
    x: float
    y: float
    width: float
    height: float

class RedactOptions(BaseModel):
    redactions: List[RedactionItem]
    confirm_irreversible: bool = True

class ToolResultResponse(BaseModel):
    success: bool
    message: str
    output_filename: str
    output_size_bytes: int
    download_url: str
    original_size_bytes: Optional[int] = None
    reduction_percentage: Optional[float] = None
    page_count: Optional[int] = None
