from sqlalchemy.orm import Session
from typing import Generic, TypeVar, Type, List, Optional, Tuple
from sqlalchemy.ext.declarative import DeclarativeMeta

T = TypeVar('T', bound=DeclarativeMeta)

class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: int) -> Optional[T]:
        return self.db.get(self.model, id)

    def get_all(self) -> List[T]:
        return self.db.query(self.model).all()

    def get_paginated(self, page: int = 1, per_page: int = 20) -> Tuple[List[T], int]:
        """
        Returns (items, total_count)
        """
        q = self.db.query(self.model)
        total = q.count()
        items = q.offset((page - 1) * per_page).limit(per_page).all()
        return items, total

    def create(self, obj: T) -> T:
        try:
            self.db.add(obj)
            self.db.commit()
            self.db.refresh(obj)
            return obj
        except Exception:
            self.db.rollback()
            raise

    def update(self, id: int, data: dict) -> Optional[T]:
        instance = self.get_by_id(id)
        if not instance:
            return None
        for k, v in data.items():
            setattr(instance, k, v)
        try:
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception:
            self.db.rollback()
            raise

    def delete(self, id: int) -> bool:
        instance = self.get_by_id(id)
        if not instance:
            return False
        try:
            self.db.delete(instance)
            self.db.commit()
            return True
        except Exception:
            self.db.rollback()
            raise