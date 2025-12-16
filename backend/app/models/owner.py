from sqlalchemy import Column, Integer, String
from .base import Base

class Owner(Base):
    __tablename__ = "owner"
    kd_owner = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(100), nullable=False)
    username_owner = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)