from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from ..models.merek import Merek
from typing import List, Optional, Any, Dict

class MerekRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Merek]:
        return self.db.query(Merek).order_by(Merek.nama_merek).all()

    def get(self, kd_merek: int) -> Optional[Merek]:
        return self.db.query(Merek).filter_by(kd_merek=kd_merek).first()

    def _clean_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        cleaned: Dict[str, Any] = {}
        for k, v in payload.items():
            if v is None:
                cleaned[k] = None
            elif isinstance(v, (str, int, float, bool)):
                cleaned[k] = v
            else:
                # HttpUrl and other pydantic types -> cast to str
                try:
                    cleaned[k] = str(v)
                except Exception:
                    cleaned[k] = v
        return cleaned

    def create(self, obj_in: dict) -> Merek:
        payload = self._clean_payload(obj_in)
        m = Merek(**payload)
        try:
            self.db.add(m)
            self.db.commit()
            self.db.refresh(m)
            return m
        except SQLAlchemyError:
            self.db.rollback()
            raise

    def update(self, kd_merek: int, patch: dict) -> Optional[Merek]:
        m = self.get(kd_merek)
        if not m:
            return None
        payload = self._clean_payload(patch)
        for k, v in payload.items():
            setattr(m, k, v)
        try:
            self.db.commit()
            self.db.refresh(m)
            return m
        except SQLAlchemyError:
            self.db.rollback()
            raise

    def delete(self, kd_merek: int) -> bool:
        m = self.get(kd_merek)
        if not m:
            return False
        try:
            self.db.delete(m)
            self.db.commit()
            return True
        except SQLAlchemyError:
            self.db.rollback()
            raise