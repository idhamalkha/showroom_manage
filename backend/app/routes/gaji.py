from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.repositories.gaji_repository import GajiRepository
from app.schemas.gaji import GajiCreate, GajiOut

router = APIRouter(prefix="/master/gaji", tags=["Master Gaji"])

@router.get("", response_model=List[GajiOut])
def list_gaji(db: Session = Depends(get_db)):
    repo = GajiRepository(db)
    return repo.get_all()

@router.post("", response_model=GajiOut, status_code=status.HTTP_201_CREATED)
def create_gaji(payload: GajiCreate, db: Session = Depends(get_db)):
    repo = GajiRepository(db)
    g = repo.create(payload.jumlah_gaji)
    return g

@router.get("/{kd_gaji}", response_model=GajiOut)
def get_gaji(kd_gaji: int, db: Session = Depends(get_db)):
    repo = GajiRepository(db)
    g = repo.get_by_id(kd_gaji)
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gaji tidak ditemukan")
    return g

@router.put("/{kd_gaji}", response_model=GajiOut)
def update_gaji(kd_gaji: int, payload: GajiCreate, db: Session = Depends(get_db)):
    repo = GajiRepository(db)
    updated = repo.update(kd_gaji, payload.jumlah_gaji)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gaji tidak ditemukan")
    return updated

@router.delete("/{kd_gaji}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gaji(kd_gaji: int, db: Session = Depends(get_db)):
    repo = GajiRepository(db)
    g = repo.get_by_id(kd_gaji)
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gaji tidak ditemukan")
    repo.delete(kd_gaji)
    return None