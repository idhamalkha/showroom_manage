from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database.connection import get_db
from app.schemas.auth import Token, TokenData, UserLogin
from app.utils.security import (
    create_access_token, 
    get_current_user,
    verify_password,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.repositories.karyawan_repository import KaryawanRepository
from app.repositories.owner_repository import OwnerRepository

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Verify credentials here
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token with role (use canonical role strings expected by get_current_user)
    access_token = create_access_token(
        data={
            "sub": user.username_karyawan or user.username_owner,
            "role": get_user_role(user).lower(),
            "id": getattr(user, "kd_karyawan", getattr(user, "kd_owner", None))
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": get_user_role(user).lower()
    }


def get_user_role(user):
    # return canonical role names expected by get_current_user
    if hasattr(user, 'username_owner'):
        return "owner"
    elif hasattr(user, 'username_karyawan'):
        return "karyawan"
    return "client"


def authenticate_user(db: Session, username: str, password: str):
    """Authenticate user against karyawan and owner tables"""
    # Try karyawan first
    k_repo = KaryawanRepository(db)
    user = k_repo.get_by_username(username)
    if user and verify_password(password, user.hashed_password):
        return user

    # If not found, try owner
    o_repo = OwnerRepository(db)
    owner = o_repo.get_by_username(username)
    if owner and verify_password(password, owner.hashed_password):
        return owner

    return None


@router.get("/me")
async def read_users_me(
    current_user = Depends(get_current_user)
):
    # Prefer backend display name fields (nama_karyawan / nama_owner). Fallbacks added for safety.
    display_name = (
        getattr(current_user, "nama_karyawan", None)
        or getattr(current_user, "nama_owner", None)
        or getattr(current_user, "fullName", None)
        or getattr(current_user, "name", None)
        or getattr(current_user, "username_karyawan", None)
        or getattr(current_user, "username_owner", None)
    )

    # Avatar/url fields commonly used by frontend (match HrdManagement upload response)
    avatar_url = (
        getattr(current_user, "foto", None)
        or getattr(current_user, "avatar", None)
        or getattr(current_user, "github_url", None)
    )

    # Human readable role: prefer jabatan.name if present; else Owner/karyawan from object shape
    if hasattr(current_user, "jabatan") and getattr(current_user, "jabatan"):
        role_label = getattr(current_user, "jabatan").nama_jabatan
    elif hasattr(current_user, "username_owner"):
        role_label = "Owner"
    else:
        role_label = getattr(current_user, "_token_role", None) or None

    user_id = getattr(current_user, "kd_karyawan", None) or getattr(current_user, "kd_owner", None)

    # salary / masa_kontrak extraction (support multiple shapes)
    salary = (
        getattr(current_user, "jumlah_gaji", None)
        or getattr(current_user, "salary", None)
        or (getattr(current_user, "gaji", None) and getattr(current_user.gaji, "jumlah_gaji", None))
    )
    masa_kontrak = (
        getattr(current_user, "masa_kontrak", None)
        or (getattr(current_user, "kontrak", None) and getattr(current_user.kontrak, "masa_kontrak", None))
        or getattr(current_user, "kd_kontrak", None)
    )

    # username (keep existing behavior)
    username = getattr(current_user, "username_karyawan", None) or getattr(current_user, "username_owner", None)

    # generated plaintext password: only include if backend kept a temporary/generated value.
    # DO NOT return hashed_password.
    generated_password = getattr(current_user, "generated_password", None) or getattr(current_user, "password_plain", None)
    password_available = bool(generated_password)

    return {
        "username": username,
        "nama": display_name,
        "role": role_label,
        "avatar_url": avatar_url,
        "id": user_id,
        # new fields for frontend
        "salary": float(salary) if salary is not None else None,
        "masa_kontrak": masa_kontrak,
        "password_available": password_available,
        "generated_password": generated_password  # may be None
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user = Depends(get_current_user)):
    # Create new access token
    access_token = create_access_token(
        data={
            "sub": current_user.username_karyawan or current_user.username_owner,
            "role": getattr(current_user, "_token_role", None),
            "id": getattr(current_user, "_token_id", None)
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": getattr(current_user, "_token_role", None)
    }