from sqlalchemy.orm import Session
from app.models.target_sales import TargetSales
from typing import List, Optional

def get_all(db: Session) -> List[TargetSales]:
    return db.query(TargetSales).all()

def get_by_id(db: Session, kd_target: int) -> Optional[TargetSales]:
    return db.query(TargetSales).filter(TargetSales.kd_target == kd_target).first()

def create(db: Session, obj_in: dict) -> TargetSales:
    obj = TargetSales(**obj_in)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def update(db: Session, kd_target: int, changes: dict) -> Optional[TargetSales]:
    obj = get_by_id(db, kd_target)
    if not obj:
        return None
    for k, v in changes.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def delete(db: Session, kd_target: int) -> bool:
    obj = get_by_id(db, kd_target)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True