from sqlalchemy.orm import Session
from app.models.mobil_warna import MobilWarna
from typing import List

class MobilWarnaRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_mobil(self, kd_mobil: int) -> List[MobilWarna]:
        return self.db.query(MobilWarna).filter_by(kd_mobil=kd_mobil).order_by(MobilWarna.is_primary.desc(), MobilWarna.kd_warna).all()

    def create(self, kd_mobil: int, payload: dict) -> MobilWarna:
        # jika is_primary true -> unset primary lainnya
        if payload.get("is_primary"):
            self.db.query(MobilWarna).filter(MobilWarna.kd_mobil == kd_mobil, MobilWarna.is_primary == True).update({"is_primary": False})
        # whitelist incoming keys to avoid unexpected kwargs
        valid_cols = set(MobilWarna.__table__.columns.keys())
        filtered = {k: v for k, v in (payload or {}).items() if k in valid_cols}
        # coerce HttpUrl/AnyUrl-like objects to plain string for foto_url
        for url_field in ("foto_url",):
            if url_field in filtered and filtered[url_field] is not None:
                try:
                    filtered[url_field] = str(filtered[url_field])
                except Exception:
                    pass

        try:
            obj = MobilWarna(kd_mobil=kd_mobil, **filtered)
            self.db.add(obj)
            self.db.commit()
            self.db.refresh(obj)
            return obj
        except Exception:
            # rollback so session is clean for callers
            try:
                self.db.rollback()
            except Exception:
                pass
            raise

    def update(self, kd_warna: int, patch: dict):
        row = self.db.query(MobilWarna).filter_by(kd_warna=kd_warna).first()
        if not row:
            return None
        # whitelist patch keys
        valid_cols = set(MobilWarna.__table__.columns.keys())
        filtered = {k: v for k, v in (patch or {}).items() if k in valid_cols}
        # coerce HttpUrl-like objects to plain string for foto_url
        for url_field in ("foto_url",):
            if url_field in filtered and filtered[url_field] is not None:
                try:
                    filtered[url_field] = str(filtered[url_field])
                except Exception:
                    pass

        if filtered.get("is_primary"):
            # unset primary on siblings
            self.db.query(MobilWarna).filter(MobilWarna.kd_mobil == row.kd_mobil, MobilWarna.is_primary == True).update({"is_primary": False})
        for k, v in filtered.items():
            setattr(row, k, v)
        try:
            self.db.commit()
            self.db.refresh(row)
            return row
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass
            raise

    def delete(self, kd_warna: int):
        row = self.db.query(MobilWarna).filter_by(kd_warna=kd_warna).first()
        if not row:
            return False
        self.db.delete(row)
        self.db.commit()
        return True