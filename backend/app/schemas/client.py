from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class CicilanResponse(BaseModel):
    kd_cicilan: int
    kd_transaksi: int
    jumlah_cicilan: float
    tenor: int
    tgl_jatuh_tempo: date
    status: str

class ServiceResponse(BaseModel):
    kd_service: int
    kd_client: int
    kd_mobil: int
    ke_service: int
    tgl_service: date
    status_service: str

class PromoClientResponse(BaseModel):
    kd_promo: int
    kd_client: int
    kd_mobil: int
    jenis_promo: str
    nilai_promo: float
    tgl_promo: date

class ComplainCreate(BaseModel):
    kd_client: int
    deskripsi: str
    status: str
    tgl_complain: date

class ComplainResponse(BaseModel):
    kd_complain: int
    kd_client: int
    deskripsi: str
    status: str
    tgl_complain: date

class MobilSayaResponse(BaseModel):
    kd_transaksi: int
    kd_mobil: int
    jumlah: int
    subtotal: float