from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from .base import Base

class Client(Base):
    __tablename__ = "client"
    kd_client = Column(Integer, primary_key=True, autoincrement=True)
    nama_client = Column(String(100), nullable=True)
    username_client = Column(String(50), unique=True, nullable=True)  # gunakan email sebagai username
    hashed_password = Column(String(255), nullable=True)

    # relationship examples (optional)
    # transaksi = relationship("Transaksi", back_populates="client")
    promos = relationship("PromoClient", back_populates="client")
    transaksi = relationship("Transaksi", back_populates="client")
    services = relationship("Service", back_populates="client")
    complains = relationship("Complain", back_populates="client")
    credit_profile = relationship("CustomerCreditProfile", back_populates="client", uselist=False, cascade="all, delete-orphan")