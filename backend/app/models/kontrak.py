from sqlalchemy import Column, Integer, String, Date
from .base import Base

class Kontrak(Base):
    __tablename__ = "kontrak"
    kd_kontrak = Column(Integer, primary_key=True, autoincrement=True)
    masa_kontrak = Column(String(100), nullable=False)
    tgl_mulai = Column(Date, nullable=True)
    tgl_habis = Column(Date, nullable=True)