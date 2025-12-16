from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base
from .dp import DP

class Transaksi(Base):
    __tablename__ = "transaksi"
    kd_transaksi = Column(Integer, primary_key=True, autoincrement=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client"))
    kd_sales = Column(Integer, ForeignKey("karyawan.kd_karyawan"))
    tanggal = Column(Date)
    metode_pembayaran = Column(String(50))
    total_harga = Column(Numeric(15,2))
    status = Column(String(50))

    client = relationship("Client", back_populates="transaksi")
    sales = relationship("Karyawan", back_populates="transaksi_sales")
    details = relationship("TransaksiDetail", back_populates="transaksi")
    cicilan = relationship("Cicilan", back_populates="transaksi")
    invoices = relationship("Invoice", back_populates="transaksi")
    payments = relationship("Payment", back_populates="transaksi")
    dp = relationship("DP", back_populates="transaksi")