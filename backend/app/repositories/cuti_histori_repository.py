from sqlalchemy.orm import Session
from app.models.cuti_histori import CutiHistori
from typing import List, Optional

def get_all(db: Session) -> List[CutiHistori]:
    return db.query(CutiHistori).all()

def get_by_id(db: Session, kd_cuti: int) -> Optional[CutiHistori]:
    return db.query(CutiHistori).filter(CutiHistori.kd_cuti == kd_cuti).first()

def create(db: Session, obj_in: dict) -> CutiHistori:
    obj = CutiHistori(**obj_in)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def update(db: Session, kd_cuti: int, changes: dict) -> Optional[CutiHistori]:
    obj = get_by_id(db, kd_cuti)
    if not obj:
        return None
    for k, v in changes.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def delete(db: Session, kd_cuti: int) -> bool:
    obj = get_by_id(db, kd_cuti)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True