from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.jabatan import Jabatan
from app.repositories.base_repository import BaseRepository

class JabatanRepository(BaseRepository[Jabatan]):
    def __init__(self, db: Session):
        # BaseRepository signature: (model, db)
        super().__init__(Jabatan, db)
        self.db = db

    def get_all(self) -> List[Jabatan]:
        return self.db.query(Jabatan).order_by(Jabatan.kd_jabatan).all()

    def get_by_id(self, kd_jabatan: int) -> Optional[Jabatan]:
        return self.db.query(Jabatan).filter(Jabatan.kd_jabatan == kd_jabatan).first()

    def create(self, nama_jabatan: str) -> Jabatan:
        j = Jabatan(nama_jabatan=nama_jabatan)
        self.db.add(j)
        self.db.commit()
        self.db.refresh(j)
        return j

    def update(self, kd_jabatan: int, nama_jabatan: str) -> Optional[Jabatan]:
        j = self.get_by_id(kd_jabatan)
        if not j:
            return None
        j.nama_jabatan = nama_jabatan
        self.db.add(j)
        self.db.commit()
        self.db.refresh(j)
        return j

    def delete(self, kd_jabatan: int) -> None:
        j = self.get_by_id(kd_jabatan)
        if not j:
            return
        self.db.delete(j)
        self.db.commit()