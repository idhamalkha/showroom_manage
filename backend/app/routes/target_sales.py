from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.repositories.target_sales_repository import get_all, get_by_id, create, update, delete
from app.schemas.target_sales import TargetSalesCreate, TargetSalesRead

router = APIRouter(prefix="/target-sales", tags=["sales"])

@router.get("/", response_model=List[TargetSalesRead])
def list_targets(db: Session = Depends(get_db)):
    return get_all(db)

@router.get("/{kd_target}", response_model=TargetSalesRead)
def get_target(kd_target: int, db: Session = Depends(get_db)):
    obj = get_by_id(db, kd_target)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.post("/", response_model=TargetSalesRead)
def create_target(payload: TargetSalesCreate, db: Session = Depends(get_db)):
    return create(db, payload.dict())

@router.put("/{kd_target}", response_model=TargetSalesRead)
def update_target(kd_target: int, payload: TargetSalesCreate, db: Session = Depends(get_db)):
    obj = update(db, kd_target, payload.dict())
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.delete("/{kd_target}", response_model=dict)
def delete_target(kd_target: int, db: Session = Depends(get_db)):
    ok = delete(db, kd_target)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}