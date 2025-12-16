from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class PromoClient(Base):
    __tablename__ = "promo_client"
    kd_promo = Column(Integer, primary_key=True, autoincrement=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client"))
    kd_mobil = Column(Integer, ForeignKey("mobil.kd_mobil"))
    jenis_promo = Column(String(100))
    nilai_promo = Column(Numeric(15,2))
    tgl_promo = Column(Date)

    client = relationship("Client", back_populates="promos")
    mobil = relationship("Mobil")