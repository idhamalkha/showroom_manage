from sqlalchemy import Column, Integer, Date, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class Service(Base):
    __tablename__ = "service"
    kd_service = Column(Integer, primary_key=True, autoincrement=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client"))
    kd_mobil = Column(Integer, ForeignKey("mobil.kd_mobil"))
    ke_service = Column(Integer)
    tgl_service = Column(Date)
    status_service = Column(String(50))

    client = relationship("Client", back_populates="services")
    mobil = relationship("Mobil")