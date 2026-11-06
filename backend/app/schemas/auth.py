from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = None
    plan: Optional[str] = "free"
    promo_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str] = None

class ProfileOut(BaseModel):
    avatar_url: Optional[str] = None
    job_title: Optional[str] = None
    organization: Optional[str] = None
    preferred_theme: str = "system"
    language: str = "en"
    storage_used_bytes: int = 0

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    organization: Optional[str] = None
    preferred_theme: Optional[str] = None
    language: Optional[str] = None

class SubscriptionOut(BaseModel):
    plan_tier: str
    status: str
    max_storage_bytes: int
    max_file_size_mb: int
    ai_credits_monthly: int
    ai_credits_used: int
    first_time_offer_used: bool = False
    current_period_end: Optional[datetime] = None

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool
    created_at: datetime
    profile: Optional[ProfileOut] = None
    subscription: Optional[SubscriptionOut] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

