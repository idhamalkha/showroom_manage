from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class TransaksiDetail(Base):
    __tablename__ = "transaksi_detail"
    kd_detail = Column(Integer, primary_key=True, autoincrement=True)
    kd_transaksi = Column(Integer, ForeignKey("transaksi.kd_transaksi"))
    kd_mobil = Column(Integer, ForeignKey("mobil.kd_mobil"))
    kd_warna = Column(Integer, ForeignKey("mobil_warna.kd_warna"), nullable=True)
    harga = Column(Numeric(15,2))
    jumlah = Column(Integer)
    subtotal = Column(Numeric(15,2))

    transaksi = relationship("Transaksi", back_populates="details")
    mobil = relationship("Mobil", back_populates="transaksi_details")
    warna = relationship("MobilWarna")

    @property
    def kd_karyawan(self):
        """Return the sales (karyawan) ID from the related transaksi"""
        return self.transaksi.kd_sales if self.transaksi else None