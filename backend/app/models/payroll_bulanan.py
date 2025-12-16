from sqlalchemy import Column, Integer, Numeric, Date, ForeignKey, DateTime, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class PayrollBulanan(Base):
    __tablename__ = "payroll_bulanan"
    
    kd_payroll_bulanan = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan"), nullable=False)
    periode = Column(Date, nullable=False)
    
    # Komponen Gaji
    gaji_pokok = Column(Numeric(15, 2), default=0)
    bonus = Column(Numeric(15, 2), default=0)
    lembur = Column(Numeric(15, 2), default=0)
    tunjangan_lainnya = Column(Numeric(15, 2), default=0)
    
    # Potongan
    potongan_absen = Column(Numeric(15, 2), default=0)
    potongan_pajak = Column(Numeric(15, 2), default=0)
    potongan_asuransi = Column(Numeric(15, 2), default=0)
    potongan_lainnya = Column(Numeric(15, 2), default=0)
    
    # Detail Perhitungan
    jumlah_hari_kerja = Column(Integer, default=0)
    jumlah_absen = Column(Integer, default=0)
    jumlah_jam_lembur = Column(Numeric(10, 2), default=0)
    
    # Total
    total_penerimaan = Column(Numeric(15, 2), default=0)
    total_potongan = Column(Numeric(15, 2), default=0)
    total_gaji = Column(Numeric(15, 2), default=0)
    
    # Status
    status = Column(String(50), default='draft')  # draft, approved, paid
    catatan = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    karyawan = relationship("Karyawan", back_populates="payroll_bulanan")
