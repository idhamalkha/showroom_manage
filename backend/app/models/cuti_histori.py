from sqlalchemy import Column, Integer, Date, Text, ForeignKey, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class CutiHistori(Base):
    __tablename__ = "cuti_histori"
    kd_cuti = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan"))
    tgl_mulai = Column(Date)
    tgl_selesai = Column(Date)
    durasi_hari = Column(Integer)
    alasan = Column(Text)
    status = Column(String(50), default="pending")  # pending, approved, rejected
    approved_by = Column(Integer, ForeignKey("karyawan.kd_karyawan"), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    karyawan = relationship("Karyawan", back_populates="cuti_histori", foreign_keys=[kd_karyawan])
    approver = relationship("Karyawan", foreign_keys=[approved_by])