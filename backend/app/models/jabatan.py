from sqlalchemy import Column, Integer, String
from .base import Base

class Jabatan(Base):
    __tablename__ = "jabatan"
    kd_jabatan = Column(Integer, primary_key=True, autoincrement=True)
    nama_jabatan = Column(String(100), nullable=False)