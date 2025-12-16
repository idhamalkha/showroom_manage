from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from app.database.connection import get_db
from sqlalchemy.orm import Session
from app.repositories.client_repository import ClientRepository
from app.utils.security import get_password_hash

router = APIRouter(prefix="/client", tags=["client"])

class FindOrCreateClientIn(BaseModel):
    email: EmailStr
    nama: str | None = None

class FindOrCreateClientOut(BaseModel):
    kd_client: int
    username_client: str
    nama_client: str | None = None

@router.post("/find-or-create", response_model=FindOrCreateClientOut)
def find_or_create_client(payload: FindOrCreateClientIn, db: Session = Depends(get_db)):
    """
    If client exists by email (username_client) return it.
    Otherwise create new client with random password (hashed) and return.

    NOTE: this endpoint does NOT require authentication so it can be called from sales/owner flows
    without an active user token. If you want to restrict it to authenticated users, restore the
    `current_user: dict = Depends(get_current_user)` parameter and ensure the frontend sends a valid
    Bearer token.
    """
    repo = ClientRepository(db)
    email = payload.email.lower()
    existing = repo.find_by_username(email)
    if existing:
        return {"kd_client": existing.kd_client, "username_client": existing.username_client, "nama_client": existing.nama_client}
    # create with random password
    pw = "auto_generated"  # optionally generate random; keep simple
    hashed = get_password_hash(pw)
    client = repo.create_client(username=email, nama=payload.nama, hashed_password=hashed)
    if not client:
        raise HTTPException(status_code=500, detail="Failed to create client")
    return {"kd_client": client.kd_client, "username_client": client.username_client, "nama_client": client.nama_client}