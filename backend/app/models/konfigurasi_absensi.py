from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime
from datetime import datetime
from .base import Base

class KonfigurasiAbsensi(Base):
    __tablename__ = "konfigurasi_absensi"
    
    kd_config = Column(Integer, primary_key=True, autoincrement=True)
    jenis_absensi = Column(String(50), unique=True, nullable=False)  # hadir, absen, izin, sakit
    potongan_persen = Column(Float, default=0.0, nullable=False)  # percentage of salary to deduct
    potongan_nominal = Column(Float, default=0.0, nullable=False)  # nominal amount if fixed deduction
    deskripsi = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
