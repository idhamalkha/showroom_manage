from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.repositories.jabatan_repository import JabatanRepository
from app.schemas.jabatan import JabatanCreate, JabatanOut

router = APIRouter(prefix="/master/jabatan", tags=["Master Jabatan"])

@router.get("", response_model=List[JabatanOut])
def list_jabatan(db: Session = Depends(get_db)):
    repo = JabatanRepository(db)
    return repo.get_all()

@router.post("", response_model=JabatanOut, status_code=status.HTTP_201_CREATED)
def create_jabatan(payload: JabatanCreate, db: Session = Depends(get_db)):
    repo = JabatanRepository(db)
    j = repo.create(payload.nama_jabatan)
    return j

@router.get("/{kd_jabatan}", response_model=JabatanOut)
def get_jabatan(kd_jabatan: int, db: Session = Depends(get_db)):
    repo = JabatanRepository(db)
    j = repo.get_by_id(kd_jabatan)
    if not j:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jabatan tidak ditemukan")
    return j

@router.put("/{kd_jabatan}", response_model=JabatanOut)
def update_jabatan(kd_jabatan: int, payload: JabatanCreate, db: Session = Depends(get_db)):
    repo = JabatanRepository(db)
    updated = repo.update(kd_jabatan, payload.nama_jabatan)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jabatan tidak ditemukan")
    return updated

@router.delete("/{kd_jabatan}", status_code=status.HTTP_204_NO_CONTENT)
def delete_jabatan(kd_jabatan: int, db: Session = Depends(get_db)):
    repo = JabatanRepository(db)
    j = repo.get_by_id(kd_jabatan)
    if not j:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jabatan tidak ditemukan")
    repo.delete(kd_jabatan)
    return None