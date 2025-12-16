# Payment model, sudah digabung semua kolom
from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey, Text, TIMESTAMP
from sqlalchemy.orm import relationship
from .base import Base

class Payment(Base):
    __tablename__ = "payment"
    kd_payment = Column(Integer, primary_key=True, autoincrement=True)
    kd_invoice = Column(Integer, ForeignKey("invoice.kd_invoice"), nullable=True)
    kd_transaksi = Column(Integer, ForeignKey("transaksi.kd_transaksi"), nullable=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client"), nullable=True)
    jumlah = Column(Numeric(15,2), nullable=False)
    jenis = Column(String(50), nullable=False)
    tanggal = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="completed")
    reference = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)
    # Approval fields
    approved_by = Column(Integer, ForeignKey("karyawan.kd_karyawan"), nullable=True)
    approved_at = Column(TIMESTAMP, nullable=True)
    approval_status = Column(String(30), default="pending") # pending, approved, rejected

    invoice = relationship("Invoice", back_populates="payments")
    transaksi = relationship("Transaksi", back_populates="payments")
    client = relationship("Client")
