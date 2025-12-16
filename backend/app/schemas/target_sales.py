from pydantic import BaseModel
from typing import Optional
from datetime import date

class TargetSalesBase(BaseModel):
    kd_karyawan: int
    periode: Optional[date] = None
    target_unit: Optional[int] = None
    target_nominal: Optional[float] = None

class TargetSalesCreate(TargetSalesBase):
    pass

class TargetSalesRead(TargetSalesBase):
    kd_target: int
    class Config:
        from_attributes = True