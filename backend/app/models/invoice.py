from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base
from datetime import datetime


class Invoice(Base):
    __tablename__ = "invoice"
    kd_invoice = Column(Integer, primary_key=True, autoincrement=True)
    kd_transaksi = Column(Integer, ForeignKey("transaksi.kd_transaksi"), nullable=False)
    nomor_invoice = Column(String(50), unique=True, nullable=True)  # e.g., "INV-2025-001"
    status = Column(String(50), default="outstanding")  # outstanding, partial, paid, overdue, cancelled
    total_amount = Column(Numeric(15, 2))
    paid_amount = Column(Numeric(15, 2), default=0)
    tanggal_jatuh_tempo = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transaksi = relationship("Transaksi", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice")
