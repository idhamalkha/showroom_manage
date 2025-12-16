from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List

from ..database.connection import get_db
from ..repositories.merek_repository import MerekRepository
from ..schemas.merek import MerekCreate, MerekRead

router = APIRouter(prefix="/api/merek", tags=["merek"])

@router.get("/", response_model=List[MerekRead])
def list_merek(db: Session = Depends(get_db)):
    repo = MerekRepository(db)
    return repo.get_all()

@router.post("/", response_model=MerekRead, status_code=status.HTTP_201_CREATED)
def create_merek(payload: MerekCreate, db: Session = Depends(get_db)):
    repo = MerekRepository(db)
    try:
        return repo.create(payload.dict())
    except SQLAlchemyError as e:
        # rollback and surface message for debugging
        db.rollback()
        # log to stdout (or use logger)
        print("DB error creating merek:", str(e))
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/{kd_merek}", response_model=MerekRead)
def get_merek(kd_merek: int, db: Session = Depends(get_db)):
    repo = MerekRepository(db)
    m = repo.get(kd_merek)
    if not m:
        raise HTTPException(status_code=404, detail="Merek not found")
    return m

@router.put("/{kd_merek}", response_model=MerekRead)
def update_merek(kd_merek: int, payload: MerekCreate, db: Session = Depends(get_db)):
    repo = MerekRepository(db)
    updated = repo.update(kd_merek, payload.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Merek not found")
    return updated

@router.delete("/{kd_merek}", status_code=status.HTTP_204_NO_CONTENT)
def delete_merek(kd_merek: int, db: Session = Depends(get_db)):
    repo = MerekRepository(db)
    ok = repo.delete(kd_merek)
    if not ok:
        raise HTTPException(status_code=404, detail="Merek not found")
    return None