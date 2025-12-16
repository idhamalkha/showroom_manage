from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List
from app.models.owner import Owner
from app.models.complain import Complain
from app.models.transaksi import Transaksi

class OwnerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_owner(self, username: str) -> Owner:
        return self.db.query(Owner).filter_by(username_owner=username).first()

    def get_by_username(self, username: str) -> Owner:
        """Alias for get_owner to match KaryawanRepository interface"""
        return self.db.query(Owner).filter_by(username_owner=username).first()

    def get_penjualan_bulanan(self, tahun: int, bulan: int) -> List[Transaksi]:
        return (
            self.db.query(Transaksi)
            .filter(extract('year', Transaksi.tanggal) == int(tahun),
                    extract('month', Transaksi.tanggal) == int(bulan))
            .all()
        )

    def get_jumlah_komplain(self, tahun: int, bulan: int) -> int:
        return (
            self.db.query(Complain)
            .filter(extract('year', Complain.tgl_complain) == int(tahun),
                    extract('month', Complain.tgl_complain) == int(bulan))
            .count()
        )