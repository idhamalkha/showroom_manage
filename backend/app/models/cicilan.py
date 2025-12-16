from sqlalchemy import Column, Integer, Numeric, Date, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class Cicilan(Base):
    __tablename__ = "cicilan"
    kd_cicilan = Column(Integer, primary_key=True, autoincrement=True)
    kd_transaksi = Column(Integer, ForeignKey("transaksi.kd_transaksi"))
    jumlah_cicilan = Column(Numeric(15,2))
    tenor = Column(Integer)
    tgl_jatuh_tempo = Column(Date)
    status = Column(String(50))

    # Relationships
    transaksi = relationship("Transaksi", back_populates="cicilan")
    schedules = relationship("CicilanSchedule", back_populates="cicilan", cascade="all, delete-orphan")