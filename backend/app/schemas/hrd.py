from pydantic import BaseModel
from typing import Optional
from datetime import date

class KaryawanCreate(BaseModel):
    nama_karyawan: str
    foto: Optional[str]
    kd_jabatan: int
    kd_gaji: int
    jumlah_gaji: float
    kd_kontrak: int
    masa_kontrak: str
    username_karyawan: str
    hashed_password: str

class KaryawanUpdate(BaseModel):
    nama_karyawan: Optional[str]
    foto: Optional[str]
    kd_jabatan: Optional[int]
    kd_gaji: Optional[int]
    jumlah_gaji: Optional[float]
    kd_kontrak: Optional[int]
    masa_kontrak: Optional[str]
    username_karyawan: Optional[str]
    hashed_password: Optional[str]

class KaryawanResponse(BaseModel):
    kd_karyawan: int
    nama_karyawan: str
    foto: Optional[str]
    kd_jabatan: int
    kd_gaji: int
    jumlah_gaji: float
    kd_kontrak: int
    masa_kontrak: str
    username_karyawan: str

class KPIResponse(BaseModel):
    kd_karyawan: int
    nama_karyawan: str
    bonus: float
    lembur: float
    cuti: int
    target_unit: int
    target_nominal: float

class TopSalesResponse(BaseModel):
    kd_karyawan: int
    nama_karyawan: str
    total_unit: int
    total_nominal: float