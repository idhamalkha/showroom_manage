from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class Complain(Base):
    __tablename__ = "complain"
    kd_complain = Column(Integer, primary_key=True, autoincrement=True)
    kd_client = Column(Integer, ForeignKey("client.kd_client"))
    deskripsi = Column(Text)
    status = Column(String(50))
    tgl_complain = Column(Date)

    client = relationship("Client", back_populates="complains")