from sqlalchemy import Column, Integer, Date, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class TargetSales(Base):
    __tablename__ = "target_sales"
    kd_target = Column(Integer, primary_key=True, autoincrement=True)
    kd_karyawan = Column(Integer, ForeignKey("karyawan.kd_karyawan"))
    periode = Column(Date)
    target_unit = Column(Integer)
    target_nominal = Column(Numeric(15,2))

    karyawan = relationship("Karyawan", back_populates="target_sales")