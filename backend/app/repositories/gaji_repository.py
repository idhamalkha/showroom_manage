from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.gaji import Gaji
from app.repositories.base_repository import BaseRepository

class GajiRepository(BaseRepository[Gaji]):
    def __init__(self, db: Session):
        # Ensure we pass (model, db) to BaseRepository
        super().__init__(Gaji, db)
        self.db = db

    def get_all(self) -> List[Gaji]:
        return self.db.query(Gaji).order_by(Gaji.kd_gaji).all()

    def get_by_id(self, kd_gaji: int) -> Optional[Gaji]:
        return self.db.query(Gaji).filter(Gaji.kd_gaji == kd_gaji).first()

    def create(self, jumlah_gaji: float) -> Gaji:
        g = Gaji(jumlah_gaji=jumlah_gaji)
        self.db.add(g)
        self.db.commit()
        self.db.refresh(g)
        return g

    def update(self, kd_gaji: int, jumlah_gaji: float) -> Optional[Gaji]:
        g = self.get_by_id(kd_gaji)
        if not g:
            return None
        g.jumlah_gaji = jumlah_gaji
        self.db.add(g)
        self.db.commit()
        self.db.refresh(g)
        return g

    def delete(self, kd_gaji: int) -> None:
        g = self.get_by_id(kd_gaji)
        if not g:
            return
        self.db.delete(g)
        self.db.commit()