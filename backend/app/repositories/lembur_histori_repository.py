from sqlalchemy.orm import Session
from app.models.lembur_histori import LemburHistori
from typing import List, Optional

def get_all(db: Session) -> List[LemburHistori]:
    return db.query(LemburHistori).all()

def get_by_id(db: Session, kd_lembur: int) -> Optional[LemburHistori]:
    return db.query(LemburHistori).filter(LemburHistori.kd_lembur == kd_lembur).first()

def create(db: Session, obj_in: dict) -> LemburHistori:
    obj = LemburHistori(**obj_in)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def update(db: Session, kd_lembur: int, changes: dict) -> Optional[LemburHistori]:
    obj = get_by_id(db, kd_lembur)
    if not obj:
        return None
    for k, v in changes.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def delete(db: Session, kd_lembur: int) -> bool:
    obj = get_by_id(db, kd_lembur)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True