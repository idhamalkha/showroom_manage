from typing import List, Dict
from sqlalchemy.orm import Session
from ..models.kelas_mobil import KelasMobil

class KelasMobilRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> List[Dict]:
        rows = self.db.query(KelasMobil).order_by(KelasMobil.nama).all()
        return [
            {
                "kd_kelas": r.kd_kelas,
                "kode": r.kode,
                "nama": r.nama,
                "deskripsi": r.deskripsi,
                "created_at": getattr(r, "created_at", None),
            }
            for r in rows
        ]

    def get_by_id(self, kd_kelas: int):
        return self.db.query(KelasMobil).filter_by(kd_kelas=kd_kelas).first()