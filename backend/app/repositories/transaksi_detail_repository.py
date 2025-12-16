from sqlalchemy.orm import Session, joinedload
from app.models.transaksi_detail import TransaksiDetail
from typing import List, Optional

def get_all(db: Session) -> List[TransaksiDetail]:
    return db.query(TransaksiDetail).options(joinedload(TransaksiDetail.transaksi)).all()

def get_by_id(db: Session, kd_detail: int) -> Optional[TransaksiDetail]:
    return db.query(TransaksiDetail).options(joinedload(TransaksiDetail.transaksi)).filter(TransaksiDetail.kd_detail == kd_detail).first()

def create(db: Session, obj_in: dict) -> TransaksiDetail:
    obj = TransaksiDetail(**obj_in)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def update(db: Session, kd_detail: int, changes: dict) -> Optional[TransaksiDetail]:
    obj = get_by_id(db, kd_detail)
    if not obj:
        return None
    for k, v in changes.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def delete(db: Session, kd_detail: int) -> bool:
    obj = get_by_id(db, kd_detail)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True