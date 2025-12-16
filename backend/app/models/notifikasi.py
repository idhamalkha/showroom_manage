from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base
import enum

class NotificationType(str, enum.Enum):
    CUTI_PENDING = "cuti_pending"
    CUTI_APPROVED = "cuti_approved"
    CUTI_REJECTED = "cuti_rejected"
    LEMBUR_PENDING = "lembur_pending"
    LEMBUR_APPROVED = "lembur_approved"
    LEMBUR_REJECTED = "lembur_rejected"
    HADIR_RECORDED = "hadir_recorded"

class Notifikasi(Base):
    __tablename__ = "notifikasi"
    
    kd_notifikasi = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan"))
    tipe_notifikasi = Column(SQLEnum(NotificationType), nullable=False)
    judul = Column(String(255), nullable=False)
    pesan = Column(Text)
    referensi_id = Column(Integer)  # ID dari cuti_histori, lembur_histori, atau absensi_histori
    referensi_tipe = Column(String(50))  # "cuti", "lembur", "hadir"
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    karyawan = relationship("Karyawan", back_populates="notifikasi")

    def mark_as_read(self):
        self.is_read = True
        self.read_at = datetime.utcnow()
