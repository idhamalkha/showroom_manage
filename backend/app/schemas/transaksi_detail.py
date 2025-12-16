from pydantic import BaseModel
from typing import Optional

class TransaksiDetailBase(BaseModel):
    kd_transaksi: int
    kd_mobil: int
    harga: Optional[float] = None
    jumlah: Optional[int] = None
    subtotal: Optional[float] = None

class TransaksiDetailCreate(TransaksiDetailBase):
    pass

class TransaksiDetailRead(TransaksiDetailBase):
    kd_detail: int
    kd_karyawan: Optional[int] = None  # sales ID from transaksi.kd_sales
    class Config:
        from_attributes = True