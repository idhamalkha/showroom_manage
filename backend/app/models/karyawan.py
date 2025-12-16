from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Date
from sqlalchemy.orm import relationship
from .base import Base

class Karyawan(Base):
    __tablename__ = "karyawan"
    kd_karyawan = Column(Integer, primary_key=True, autoincrement=True)
    nama_karyawan = Column(String(100), nullable=False)
    foto = Column(String(255))
    # new date fields
    tgl_masuk = Column(Date, nullable=True)
    tgl_lahir = Column(Date, nullable=True)
    kd_jabatan = Column(Integer, ForeignKey("jabatan.kd_jabatan"))
    kd_gaji = Column(Integer, ForeignKey("gaji.kd_gaji"))
    jumlah_gaji = Column(Numeric(15,2))
    kd_kontrak = Column(Integer, ForeignKey("kontrak.kd_kontrak"))
    masa_kontrak = Column(String(100))
    username_karyawan = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    jabatan = relationship("Jabatan")
    gaji = relationship("Gaji")
    kontrak = relationship("Kontrak")
    lembur_histori = relationship("LemburHistori", back_populates="karyawan", foreign_keys='LemburHistori.kd_karyawan')
    lembur_approvals = relationship("LemburHistori", foreign_keys='LemburHistori.approved_by', viewonly=True)
    cuti_histori = relationship("CutiHistori", back_populates="karyawan", foreign_keys='CutiHistori.kd_karyawan')
    cuti_approvals = relationship("CutiHistori", foreign_keys='CutiHistori.approved_by', viewonly=True)
    target_sales = relationship("TargetSales", back_populates="karyawan")
    payrolls = relationship("Payroll", back_populates="karyawan")
    payroll_bulanan = relationship("PayrollBulanan", back_populates="karyawan")
    transaksi_sales = relationship("Transaksi", back_populates="sales", foreign_keys='Transaksi.kd_sales')
    absensi_histori = relationship("AbsensiHistori", back_populates="karyawan")
    notifikasi = relationship("Notifikasi", back_populates="karyawan")