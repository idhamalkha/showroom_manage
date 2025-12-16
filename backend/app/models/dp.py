from sqlalchemy import Column, Integer, Numeric, Date, String, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from .base import Base

class DP(Base):
    __tablename__ = "dp"
    kd_dp = Column(Integer, primary_key=True, autoincrement=True)
    kd_transaksi = Column(Integer, ForeignKey("transaksi.kd_transaksi"))
    jumlah = Column(Numeric(15,2))
    tanggal = Column(Date)
    status = Column(String(50))
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

    transaksi = relationship("Transaksi", back_populates="dp")
