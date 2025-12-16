from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.repositories.kontrak_repository import KontrakRepository
from app.schemas.kontrak import KontrakOut

router = APIRouter(prefix="/master/kontrak", tags=["Master Kontrak"])

@router.get("", response_model=List[KontrakOut])
def get_all_kontrak(db: Session = Depends(get_db)):
    return KontrakRepository.get_all(db)

@router.get("/{kontrak_id}", response_model=KontrakOut)
def get_kontrak_by_id(kontrak_id: int, db: Session = Depends(get_db)):
    kontrak = KontrakRepository.get_by_id(db, kontrak_id)
    if not kontrak:
        raise HTTPException(status_code=404, detail="Kontrak not found")
    return kontrak

@router.post("", response_model=KontrakOut, status_code=status.HTTP_201_CREATED)
def create_kontrak(masa_kontrak: str, db: Session = Depends(get_db)):
    return KontrakRepository.create(db, masa_kontrak)

@router.delete("/{kontrak_id}", response_model=KontrakOut)
def delete_kontrak(kontrak_id: int, db: Session = Depends(get_db)):
    kontrak = KontrakRepository.delete(db, kontrak_id)
    if not kontrak:
        raise HTTPException(status_code=404, detail="Kontrak not found")
    return kontrak