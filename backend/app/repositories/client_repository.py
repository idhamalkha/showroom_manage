from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
from app.models.client import Client
from app.models.cicilan import Cicilan
from app.models.service import Service
from app.models.promo_client import PromoClient
from app.models.complain import Complain
from app.models.transaksi import Transaksi
from .base_repository import BaseRepository
from sqlalchemy.exc import IntegrityError

class ClientRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Client, db)

    def find_by_username(self, username: str):
        if not username:
            return None
        return self.db.query(self.model).filter(self.model.username_client == username).first()

    def create_client(self, username: str, nama: str | None = None, hashed_password: str | None = None):
        client = self.model(username_client=username, nama_client=nama, hashed_password=hashed_password)
        try:
            self.db.add(client)
            self.db.commit()
            self.db.refresh(client)
            return client
        except IntegrityError:
            self.db.rollback()
            return self.find_by_username(username)

    def get_client(self, username: str) -> Optional[Client]:
        return self.db.query(Client).filter_by(username_client=username).first()

    def get_cicilan_by_client(self, kd_client: int) -> List[Cicilan]:
        return (
            self.db.query(Cicilan)
            .join(Transaksi, Cicilan.kd_transaksi == Transaksi.kd_transaksi)
            .filter(Transaksi.kd_client == kd_client)
            .all()
        )

    def get_service_by_client(self, kd_client: int) -> List[Service]:
        return self.db.query(Service).filter_by(kd_client=kd_client).all()

    def get_mobil_saya(self, kd_client: int) -> List[Transaksi]:
        return self.db.query(Transaksi).filter_by(kd_client=kd_client).all()

    def get_promo_by_client(self, kd_client: int) -> List[PromoClient]:
        return self.db.query(PromoClient).filter_by(kd_client=kd_client).all()

    def create_complain(self, complain: Complain) -> Complain:
        try:
            self.db.add(complain)
            self.db.commit()
            self.db.refresh(complain)
            return complain
        except Exception:
            self.db.rollback()
            raise

    def list_clients(self, page: int = 1, per_page: int = 20) -> Tuple[List[Client], int]:
        q = self.db.query(Client)
        total = q.count()
        items = q.offset((page - 1) * per_page).limit(per_page).all()
        return items, total

    # Note: create_client defined earlier (create_client(self, username, nama, hashed_password...)).
    # The earlier implementation is used by routes; do not redefine here.