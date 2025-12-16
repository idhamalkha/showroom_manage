from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, func, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class MobilWarna(Base):
    __tablename__ = "mobil_warna"
    kd_warna = Column(Integer, primary_key=True, autoincrement=True)
    kd_mobil = Column(Integer, ForeignKey("mobil.kd_mobil", ondelete="CASCADE"), nullable=False)
    nama_warna = Column(String(100), nullable=True)
    kode_hex = Column(String(7), nullable=True)
    foto_url = Column(String(512), nullable=True)
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)  # Add this line
    created_at = Column(TIMESTAMP, server_default=func.now())

    mobil = relationship("Mobil", back_populates="warna_list")