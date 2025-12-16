from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from .base import Base

class Mobil(Base):
    __tablename__ = "mobil"
    kd_mobil = Column(Integer, primary_key=True, autoincrement=True)
    nama_mobil = Column(String(100), nullable=False)
    kelas_mobil = Column(String(10), nullable=False)

    # harga dasar (sebelumnya ada) dan tambahan fields
    harga_mobil = Column(Numeric(15,2), nullable=False)

    # NEW fields
    kd_bonus = Column(Integer, ForeignKey("bonus.kd_bonus"))
    kd_merek = Column(Integer, ForeignKey("merek.kd_merek"), nullable=True)
    # FK to kelas_mobil master table
    kd_kelas = Column(Integer, ForeignKey("kelas_mobil.kd_kelas"), nullable=True)

    foto_url = Column(String(512), nullable=True)
    video_url = Column(String(512), nullable=True)

    # recommended new attributes
    engine_cc = Column(Integer, nullable=True)
    power_ps = Column(Integer, nullable=True)
    tahun_keluaran = Column(Integer, nullable=True)
    harga_off_road = Column(Numeric(15,2), nullable=True)
    harga_on_road = Column(Numeric(15,2), nullable=True)

    # additional requested fields
    transmisi = Column(String(30), nullable=True)  # e.g. 'Manual', 'Automatic', 'CVT'
    seats = Column(Integer, nullable=True)         # jumlah kursi duduk
    drivetrain = Column(SAEnum('FWD','RWD','4WD','AWD', name='drivetrain_enum'), nullable=True)
    warna_tersedia = Column(ARRAY(String), nullable=True)  # array of color names (Postgres TEXT[])
    # status: active / inactive / coming_soon etc.
    status = Column(String(30), nullable=True, server_default="active")

    # Add new column for jenis_bahan_bakar
    jenis_bahan_bakar = Column(SAEnum('Gasoline', 'Diesel', 'Electrified', 
                                    name='fuel_type_enum'), 
                              nullable=True)

    bonus = relationship("Bonus", backref="mobils")
    transaksi_details = relationship("TransaksiDetail", back_populates="mobil")
    merek = relationship("Merek", back_populates="mobil")
    # relation to kelas_mobil master
    kelas = relationship("KelasMobil", backref="mobils")
    warna_list = relationship("MobilWarna", back_populates="mobil", cascade="all, delete-orphan", lazy="select")