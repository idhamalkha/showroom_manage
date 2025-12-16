from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.repositories.mobil_warna_repository import MobilWarnaRepository
from app.schemas.sales import MobilWarnaCreate, MobilWarnaRead

router = APIRouter(prefix="/api/mobil/{kd_mobil}/warna", tags=["mobil-warna"])

@router.get("/", response_model=List[MobilWarnaRead])
def list_warna(kd_mobil: int, db: Session = Depends(get_db)):
    repo = MobilWarnaRepository(db)
    return repo.list_by_mobil(kd_mobil)

@router.post("/", response_model=MobilWarnaRead, status_code=201)
def create_warna(kd_mobil: int, payload: MobilWarnaCreate, db: Session = Depends(get_db)):
    repo = MobilWarnaRepository(db)
    try:
        return repo.create(kd_mobil, payload.dict())
    except Exception as e:
        # log and return a clearer error for debugging
        import traceback, logging
        logging.getLogger(__name__).exception('create_warna failed for kd_mobil=%s', kd_mobil)
        raise HTTPException(status_code=500, detail=str(e) or 'Database error')

@router.put("/{kd_warna}", response_model=MobilWarnaRead)
def update_warna(kd_mobil: int, kd_warna: int, payload: MobilWarnaCreate, db: Session = Depends(get_db)):
    repo = MobilWarnaRepository(db)
    try:
        updated = repo.update(kd_warna, payload.dict(exclude_unset=True))
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception('update_warna failed kd_warna=%s', kd_warna)
        raise HTTPException(status_code=500, detail=str(e) or 'Database error')
    if not updated:
        raise HTTPException(status_code=404, detail="warna not found")
    return updated

@router.delete("/{kd_warna}", status_code=204)
def delete_warna(kd_mobil: int, kd_warna: int, db: Session = Depends(get_db)):
    repo = MobilWarnaRepository(db)
    try:
        ok = repo.delete(kd_warna)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception('delete_warna failed kd_warna=%s', kd_warna)
        raise HTTPException(status_code=500, detail=str(e) or 'Database error')
    if not ok:
        raise HTTPException(status_code=404, detail="warna not found")
    return None