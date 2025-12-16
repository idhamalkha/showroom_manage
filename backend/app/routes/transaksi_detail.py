from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.repositories.transaksi_detail_repository import get_all, get_by_id, create, update, delete
from app.schemas.transaksi_detail import TransaksiDetailCreate, TransaksiDetailRead

router = APIRouter(prefix="/transaksi-detail", tags=["transaksi"])

@router.get("/", response_model=List[TransaksiDetailRead])
def list_items(db: Session = Depends(get_db)):
    return get_all(db)

@router.get("/{kd_detail}", response_model=TransaksiDetailRead)
def get_item(kd_detail: int, db: Session = Depends(get_db)):
    obj = get_by_id(db, kd_detail)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.post("/", response_model=TransaksiDetailRead)
def create_item(payload: TransaksiDetailCreate, db: Session = Depends(get_db)):
    return create(db, payload.dict())

@router.put("/{kd_detail}", response_model=TransaksiDetailRead)
def update_item(kd_detail: int, payload: TransaksiDetailCreate, db: Session = Depends(get_db)):
    obj = update(db, kd_detail, payload.dict())
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.delete("/{kd_detail}", response_model=dict)
def delete_item(kd_detail: int, db: Session = Depends(get_db)):
    ok = delete(db, kd_detail)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}