from sqlalchemy import Column, Integer, String, Date, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class AbsensiHistori(Base):
    __tablename__ = "absensi_histori"
    
    kd_absensi = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan", ondelete="CASCADE"), nullable=False)
    tgl_absensi = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="hadir")  # hadir, absen, izin, sakit
    keterangan = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('kd_karyawan', 'tgl_absensi', name='uq_karyawan_tgl'),
    )
    
    karyawan = relationship("Karyawan", back_populates="absensi_histori")
