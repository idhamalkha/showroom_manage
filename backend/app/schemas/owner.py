from pydantic import BaseModel
from typing import List
from datetime import date

class PenjualanBulananResponse(BaseModel):
    kd_transaksi: int
    tanggal: date
    total_harga: float

class KomplainCountResponse(BaseModel):
    jumlah_komplain: int