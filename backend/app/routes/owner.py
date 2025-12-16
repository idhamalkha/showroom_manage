from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.repositories.owner_repository import OwnerRepository
from app.utils.permissions import require_role

router = APIRouter(prefix="/owner", tags=["Owner"])

def _user_identifier(user):
    return getattr(user, "username_owner", None) or getattr(user, "username_karyawan", None) or getattr(user, "username_client", None)

@router.get("/dashboard/penjualan")
def get_penjualan_bulanan(
    tahun: int,
    bulan: int,
    db: Session = Depends(get_db),
    current_user = require_role(["Owner"])
):
    repo = OwnerRepository(db)
    # metadata: who requested the report
    requester = _user_identifier(current_user)
    data = repo.get_penjualan_bulanan(tahun, bulan)
    return {"requested_by": requester, "data": data}

@router.get("/dashboard/komplain")
def get_jumlah_komplain(
    tahun: int,
    bulan: int,
    db: Session = Depends(get_db),
    current_user = require_role(["Owner"])
):
    repo = OwnerRepository(db)
    requester = _user_identifier(current_user)
    count = repo.get_jumlah_komplain(tahun, bulan)
    return {"requested_by": requester, "jumlah_komplain": count}