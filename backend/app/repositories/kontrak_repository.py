from sqlalchemy.orm import Session
from app.models.kontrak import Kontrak

class KontrakRepository:
    @staticmethod
    def get_all(db: Session):
        return db.query(Kontrak).all()

    @staticmethod
    def get_by_id(db: Session, kontrak_id: int):
        return db.query(Kontrak).filter(Kontrak.kd_kontrak == kontrak_id).first()

    @staticmethod
    def create(db: Session, masa_kontrak: str):
        kontrak = Kontrak(masa_kontrak=masa_kontrak)
        db.add(kontrak)
        db.commit()
        db.refresh(kontrak)
        return kontrak

    @staticmethod
    def delete(db: Session, kontrak_id: int):
        kontrak = db.query(Kontrak).filter(Kontrak.kd_kontrak == kontrak_id).first()
        if kontrak:
            db.delete(kontrak)
            db.commit()
        return kontrak