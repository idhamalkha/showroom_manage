from pydantic import BaseModel, Field
from typing import Optional
from datetime import date

class KaryawanCreate(BaseModel):
    nama_karyawan: str
    kd_jabatan: Optional[int] = None
    kd_gaji: Optional[int] = None
    kd_kontrak: Optional[int] = None
    masa_kontrak: Optional[str] = None
    tgl_masuk: Optional[date] = None
    tgl_lahir: Optional[date] = None
    foto: Optional[str] = None

class KaryawanOut(BaseModel):
    kd_karyawan: int
    nama_karyawan: Optional[str] = None
    foto: Optional[str] = None
    kd_jabatan: Optional[int] = None
    kd_gaji: Optional[int] = None
    masa_kontrak: Optional[str] = None
    tgl_masuk: Optional[date] = None
    tgl_lahir: Optional[date] = None
    username_karyawan: Optional[str] = None

    class Config:
        from_attributes = True