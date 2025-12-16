from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, func
from sqlalchemy.orm import relationship
from .base import Base

class Merek(Base):
    __tablename__ = "merek"
    kd_merek = Column(Integer, primary_key=True, autoincrement=True)
    nama_merek = Column(String(150), nullable=False)
    deskripsi = Column(Text, nullable=True)
    logo_url = Column(String(512), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    mobil = relationship("Mobil", back_populates="merek", lazy="select")