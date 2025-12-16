from pydantic import BaseModel
from typing import Optional
from datetime import date

class LemburHistoriBase(BaseModel):
    tgl_lembur: date
    jam_lembur: float
    alasan: Optional[str] = None

class LemburHistoriCreate(LemburHistoriBase):
    pass

class LemburHistoriRead(BaseModel):
    kd_lembur: int
    kd_karyawan: int
    tgl_lembur: date
    jam_lembur: float
    alasan: Optional[str] = None
    status: str
    class Config:
        from_attributes = True