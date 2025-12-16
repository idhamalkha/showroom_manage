from sqlalchemy import Column, Integer, Numeric, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Payroll(Base):
    __tablename__ = "payroll"
    kd_payroll = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan"))
    gaji_pokok = Column(Numeric(15,2))
    bonus = Column(Numeric(15,2))
    lembur = Column(Numeric(15,2))
    potongan = Column(Numeric(15,2))
    jumlah_absen = Column(Integer, default=0)
    potongan_absen = Column(Numeric(15,2), default=0)
    total_gaji = Column(Numeric(15,2))
    periode = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    karyawan = relationship("Karyawan", back_populates="payrolls")