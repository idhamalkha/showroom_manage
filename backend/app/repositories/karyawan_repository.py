from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.karyawan import Karyawan
from app.repositories.base_repository import BaseRepository


class KaryawanRepository(BaseRepository[Karyawan]):
    def __init__(self, db: Session):
        # BaseRepository takes (model, db)
        super().__init__(Karyawan, db)
        self.db = db

    def get_by_username(self, username: str) -> Optional[Karyawan]:
        return self.db.query(Karyawan).filter(Karyawan.username_karyawan == username).first()
 
    def get_by_divisi_paginated(self, kd_jabatan: int, page: int = 1, per_page: int = 20) -> tuple[List[Karyawan], int]:
        q = self.db.query(Karyawan).filter_by(kd_jabatan=kd_jabatan)
        total = q.count()
        items = q.offset((page - 1) * per_page).limit(per_page).all()
        return items, total