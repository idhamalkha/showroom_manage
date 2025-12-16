from sqlalchemy import Column, Integer, Numeric
from .base import Base

class Gaji(Base):
    __tablename__ = "gaji"
    kd_gaji = Column(Integer, primary_key=True, autoincrement=True)
    jumlah_gaji = Column(Numeric(15,2), nullable=False)