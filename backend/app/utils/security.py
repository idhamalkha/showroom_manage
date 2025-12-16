from datetime import datetime, timedelta
from typing import Any, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
import hashlib
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.repositories.karyawan_repository import KaryawanRepository
from app.repositories.client_repository import ClientRepository
from app.repositories.owner_repository import OwnerRepository

SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours - sufficient for typical work session

# prefer bcrypt for new hashes
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# optional oauth2 (does not raise if missing)
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# alias used elsewhere
def get_password_hash(password: str) -> str:
    return hash_password(password)


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    if not hashed_password:
        return False
    try:
        # primary: passlib managed hashes (bcrypt, etc.)
        return pwd_context.verify(plain_password, hashed_password)
    except UnknownHashError:
        # legacy: sha256 hex stored (64 hex chars)
        try:
            hp = str(hashed_password).strip().lower()
            if len(hp) == 64 and all(c in "0123456789abcdef" for c in hp):
                return hashlib.sha256(plain_password.encode()).hexdigest() == hp
        except Exception:
            pass
        # final fallback: plaintext compare (compat only)
        return plain_password == hashed_password
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Any:
    """
    Decode token and return the correct user object based on role claim.
    Token must include: sub (username), role (karyawan|client|owner), id (user id)
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        user_id = payload.get("id")
        if username is None or role is None:
            raise credentials_exception

        role = role.lower()
        if role == "karyawan":
            repo = KaryawanRepository(db)
            user = repo.get_by_username(username)
        elif role == "client":
            repo = ClientRepository(db)
            user = repo.get_client(username)
        elif role == "owner":
            repo = OwnerRepository(db)
            user = repo.get_owner(username)
        else:
            raise credentials_exception

        if user is None:
            raise credentials_exception

        # attach role and id to returned object for convenience
        setattr(user, "_token_role", role)
        setattr(user, "_token_id", user_id)
        return user
    except JWTError:
        raise credentials_exception


async def get_current_user_optional(token: str = Depends(oauth2_optional), db: Session = Depends(get_db)) -> Any | None:
    """Return the current user if token present and valid, otherwise None.
    This is useful for public endpoints that accept an optional bearer token.
    """
    if not token:
        return None
    try:
        return await get_current_user(token, db)
    except HTTPException:
        # invalid token -> treat as anonymous
        return None


# convenience dependencies
def get_current_karyawan(current_user: Any = Depends(get_current_user)):
    if getattr(current_user, "_token_role", None) != "karyawan":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a karyawan")
    return current_user


def get_current_client(current_user: Any = Depends(get_current_user)):
    if getattr(current_user, "_token_role", None) != "client":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a client")
    return current_user


def get_current_owner(current_user: Any = Depends(get_current_user)):
    if getattr(current_user, "_token_role", None) != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an owner")
    return current_user