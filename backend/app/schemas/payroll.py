from pydantic import BaseModel
from typing import Optional
from datetime import date

class PayrollBase(BaseModel):
    kd_karyawan: int
    gaji_pokok: Optional[float] = None
    bonus: Optional[float] = None
    lembur: Optional[float] = None
    potongan: Optional[float] = None
    total_gaji: Optional[float] = None
    periode: Optional[date] = None

class PayrollCreate(PayrollBase):
    pass

class PayrollRead(PayrollBase):
    kd_payroll: int
    class Config:
        from_attributes = True