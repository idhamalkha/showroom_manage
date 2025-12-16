from pydantic import BaseModel
from typing import Optional

class GajiCreate(BaseModel):
    jumlah_gaji: float

class GajiOut(BaseModel):
    kd_gaji: int
    jumlah_gaji: Optional[float] = None

    class Config:
        from_attributes = True