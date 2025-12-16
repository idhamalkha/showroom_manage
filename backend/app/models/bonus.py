from sqlalchemy import Column, Integer, String, Numeric, Text
from .base import Base

class Bonus(Base):
    __tablename__ = "bonus"
    kd_bonus = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(64), nullable=False)          # contoh: "tier <300m"
    persen = Column(Numeric(6,4), nullable=True)       # decimal fraction, e.g. 0.01
    jumlah_bonus = Column(Numeric(18,2), nullable=True) # absolute amount (Rp) -- optional
    deskripsi = Column(Text, nullable=True)