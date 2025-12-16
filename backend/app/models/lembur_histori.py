from sqlalchemy import Column, Integer, Numeric, Date, ForeignKey, String, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class LemburHistori(Base):
    __tablename__ = "lembur_histori"
    kd_lembur = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan"))
    tgl_lembur = Column(Date)
    jam_lembur = Column(Float)  # Could be 1.5 hours, 2 hours, etc
    bayaran_lembur = Column(Numeric(15,2), nullable=True)
    status = Column(String(50), default="pending")  # pending, approved, rejected
    alasan = Column(String(255), nullable=True)
    approved_by = Column(Integer, ForeignKey("karyawan.kd_karyawan"), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    karyawan = relationship("Karyawan", back_populates="lembur_histori", foreign_keys=[kd_karyawan])
    approver = relationship("Karyawan", foreign_keys=[approved_by])