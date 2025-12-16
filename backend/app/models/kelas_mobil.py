from sqlalchemy import Column, Integer, String, Text, DateTime
from .base import Base
from sqlalchemy.sql import func

class KelasMobil(Base):
    __tablename__ = "kelas_mobil"
    kd_kelas = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(60), unique=True, nullable=False)
    nama = Column(String(120), nullable=False)
    deskripsi = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())