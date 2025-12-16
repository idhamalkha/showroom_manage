from typing import List, Optional
from pydantic import BaseModel, HttpUrl
from datetime import date
from decimal import Decimal

class TransaksiDetailCreate(BaseModel):
    kd_mobil: int
    kd_warna: Optional[int] = None  # Color variant selected
    harga: float
    jumlah: int
    subtotal: float

class TransaksiCreate(BaseModel):
    kd_client: int
    kd_sales: int  # Required, tidak optional
    tanggal: date
    metode_pembayaran: Optional[str] = None
    details: List[TransaksiDetailCreate]
    # optional cicilan metadata sent by frontend when metode_pembayaran == 'cicilan'
    dp: Optional[float] = None
    jumlah_cicilan: Optional[float] = None
    tenor: Optional[int] = None
    estimasi_per_bulan: Optional[float] = None
    harga: Optional[float] = None

class MobilCreate(BaseModel):
    nama_mobil: str
    kelas_mobil: str
    harga_mobil: float
    status: Optional[str] = None
    foto_url: Optional[HttpUrl] = None
    video_url: Optional[HttpUrl] = None
    kd_merek: Optional[int] = None
    kd_kelas: Optional[int] = None
    engine_cc: Optional[int] = None
    power_ps: Optional[int] = None
    tahun_keluaran: Optional[int] = None
    harga_off_road: Optional[float] = None
    harga_on_road: Optional[float] = None
    transmisi: Optional[str] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    warna_tersedia: Optional[List[str]] = None
    kd_bonus: Optional[int] = None  # optional: backend can compute if omitted
    jenis_bahan_bakar: Optional[str] = 'Gasoline'  # Default to Gasoline

class MobilUpdate(BaseModel):
    nama_mobil: Optional[str] = None
    kelas_mobil: Optional[str] = None
    harga_mobil: Optional[float] = None
    status: Optional[str] = None
    foto_url: Optional[HttpUrl] = None
    video_url: Optional[HttpUrl] = None
    kd_merek: Optional[int] = None
    kd_kelas: Optional[int] = None
    engine_cc: Optional[int] = None
    power_ps: Optional[int] = None
    tahun_keluaran: Optional[int] = None
    harga_off_road: Optional[float] = None
    harga_on_road: Optional[float] = None
    transmisi: Optional[str] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    warna_tersedia: Optional[List[str]] = None
    kd_bonus: Optional[int] = None
    jenis_bahan_bakar: Optional[str] = None

class TargetSalesResponse(BaseModel):
    # keep as-is or extend as needed
    total_sales: float = 0.0
    target: float = 0.0

class MobilWarnaCreate(BaseModel):
    nama_warna: Optional[str] = None
    kode_hex: Optional[str] = None
    foto_url: Optional[HttpUrl] = None
    is_primary: Optional[bool] = False
    is_active: Optional[bool] = True  # Add this line

class MobilWarnaRead(MobilWarnaCreate):
    kd_warna: int
    kd_mobil: int

    class Config:
        from_attributes = True

class TransaksiInvoiceResponse(BaseModel):
    invoice_id: str
    tanggal: date
    client: dict
    sales: dict 
    details: List[dict]
    total: float
    metode_pembayaran: Optional[str]
    status: Optional[str]
    # cicilan fields (optional)
    dp: Optional[float] = None
    jumlah_cicilan: Optional[float] = None
    tenor: Optional[int] = None
    estimasi_per_bulan: Optional[float] = None
    harga: Optional[float] = None

    class Config:
        from_attributes = True