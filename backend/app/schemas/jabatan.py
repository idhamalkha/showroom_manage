from pydantic import BaseModel
from typing import Optional

class JabatanCreate(BaseModel):
    nama_jabatan: str

class JabatanOut(BaseModel):
    kd_jabatan: int
    nama_jabatan: Optional[str] = None

    class Config:
        from_attributes = True