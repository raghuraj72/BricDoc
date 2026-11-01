from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    oauth2_scheme
)
from app.models.user import User, Profile, Subscription
from app.models.audit import AuditLog
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserOut,
    ProfileUpdate,
    PasswordChangeRequest,
    PasswordResetRequest
)

router = APIRouter()

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    """Dependency that authenticates JWT token and loads current active user."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")
        
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return user

def get_current_user_optional(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[User]:
    """Optional authentication for public/hybrid endpoints."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            return db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    except Exception:
        pass
    return None

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """Register a new user account with initial profile and subscription."""
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email.lower(),
        hashed_password=hashed_pw,
        full_name=user_in.full_name or user_in.email.split("@")[0],
        is_active=True,
        is_verified=False
    )
    db.add(new_user)
    db.flush()

    # Create profile
    new_profile = Profile(user_id=new_user.id)
    db.add(new_profile)

    # Create default Free tier subscription
    new_sub = Subscription(user_id=new_user.id, plan_tier="free")
    db.add(new_sub)

    # Audit log
    audit = AuditLog(
        user_id=new_user.id,
        action="REGISTER",
        resource_type="user",
        resource_id=new_user.id
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(subject=new_user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name
    )

@router.post("/login", response_model=TokenResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticate email and password, returning JWT access token."""
    user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled.")

    access_token = create_access_token(subject=user.id)
    
    audit = AuditLog(user_id=user.id, action="LOGIN", resource_type="user", resource_id=user.id)
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name
    )

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user profile and subscription details."""
    return current_user

@router.put("/profile", response_model=UserOut)
def update_profile(
    profile_in: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update profile and display settings."""
    if profile_in.full_name is not None:
        current_user.full_name = profile_in.full_name
    
    if current_user.profile:
        if profile_in.job_title is not None:
            current_user.profile.job_title = profile_in.job_title
        if profile_in.organization is not None:
            current_user.profile.organization = profile_in.organization
        if profile_in.preferred_theme is not None:
            current_user.profile.preferred_theme = profile_in.preferred_theme
        if profile_in.language is not None:
            current_user.profile.language = profile_in.language

    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/change-password")
def change_password(
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change account password with verification."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password incorrect.")
    
    current_user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password changed successfully."}

@router.post("/forgot-password")
def forgot_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    """Initiate password reset process."""
    user = db.query(User).filter(User.email == req.email.lower()).first()
    # Always return success message to avoid user enumeration
    return {"message": "If this email is registered, password reset instructions have been sent."}
