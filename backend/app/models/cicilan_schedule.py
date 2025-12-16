from sqlalchemy import Column, Integer, Numeric, Date, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class CicilanSchedule(Base):
    """
    Jadwal pembayaran cicilan detail per bulan.
    Satu cicilan bisa punya multiple schedule (cicilan ke-1, ke-2, dst)
    """
    __tablename__ = "cicilan_schedule"

    kd_schedule = Column(Integer, primary_key=True, index=True)
    kd_cicilan = Column(Integer, ForeignKey("cicilan.kd_cicilan", ondelete="CASCADE"), nullable=False, index=True)
    nomor_cicilan = Column(Integer, nullable=False)  # Cicilan ke-1, ke-2, dst
    jumlah = Column(Numeric(15, 2), nullable=False)  # Jumlah per cicilan
    tgl_jatuh_tempo = Column(Date, nullable=False, index=True)
    status = Column(String(50), default="pending", index=True)  # pending, paid, overdue, skipped
    tgl_pembayaran = Column(Date, nullable=True)  # Tanggal pembayaran actual
    kd_payment = Column(Integer, ForeignKey("payment.kd_payment", ondelete="SET NULL"), nullable=True)
    catatan = Column(String(500), nullable=True)  # Kolom untuk notes/catatan
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    cicilan = relationship("Cicilan", back_populates="schedules")
    payment = relationship("Payment")
