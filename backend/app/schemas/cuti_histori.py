from pydantic import BaseModel
from typing import Optional
from datetime import date

class CutiHistoriBase(BaseModel):
    tgl_mulai: date
    tgl_selesai: date
    alasan: Optional[str] = None

class CutiHistoriCreate(CutiHistoriBase):
    pass

class CutiHistoriRead(BaseModel):
    kd_cuti: int
    kd_karyawan: int
    tgl_mulai: date
    tgl_selesai: date
    durasi_hari: int
    alasan: Optional[str] = None
    status: str
    class Config:
        from_attributes = True