from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.repositories.kelas_mobil_repository import KelasMobilRepository
from app.schemas.kelas_mobil import KelasMobilResponse

router = APIRouter()

@router.get("/kelas_mobil", response_model=List[KelasMobilResponse], tags=["master"])
def list_kelas_mobil(db: Session = Depends(get_db)):
    repo = KelasMobilRepository(db)
    return repo.list_all()

@router.get("/kelas_mobil/{kd_kelas}", response_model=KelasMobilResponse, tags=["master"])
def get_kelas_mobil(kd_kelas: int, db: Session = Depends(get_db)):
    repo = KelasMobilRepository(db)
    row = repo.get_by_id(kd_kelas)
    if not row:
        raise HTTPException(status_code=404, detail="Kelas mobil tidak ditemukan")
    return {
        "kd_kelas": row.kd_kelas,
        "kode": row.kode,
        "nama": row.nama,
        "deskripsi": row.deskripsi,
        "created_at": getattr(row, "created_at", None),
    }