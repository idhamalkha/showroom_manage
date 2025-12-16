from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class KelasMobilResponse(BaseModel):
    kd_kelas: int
    kode: str
    nama: str
    deskripsi: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True