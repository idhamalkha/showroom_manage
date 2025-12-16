from pydantic import BaseModel
from typing import Optional
from datetime import date


class PaymentCreate(BaseModel):
    kd_transaksi: Optional[int] = None
    jumlah: float
    jenis: str
    tanggal: Optional[date] = None
    status: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None


class PaymentOut(BaseModel):
    kd_payment: int
    kd_transaksi: Optional[int] = None
    jumlah: float
    jenis: str
    tanggal: Optional[date] = None
    status: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True
from pydantic import BaseModel
from typing import List
from datetime import date

class TransaksiResponse(BaseModel):
    kd_transaksi: int
    kd_client: int
    kd_sales: int
    tanggal: date
    metode_pembayaran: str
    total_harga: float
    status: str

class PayrollResponse(BaseModel):
    kd_payroll: int
    kd_karyawan: int
    gaji_pokok: float
    bonus: float
    lembur: float
    potongan: float
    total_gaji: float
    periode: date

class LaporanKeuanganResponse(BaseModel):
    transaksi: List[TransaksiResponse]
    payroll: List[PayrollResponse]