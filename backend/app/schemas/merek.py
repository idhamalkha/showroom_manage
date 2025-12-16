from pydantic import BaseModel, HttpUrl
from typing import Optional

class MerekBase(BaseModel):
    nama_merek: str
    deskripsi: Optional[str] = None
    logo_url: Optional[HttpUrl] = None

class MerekCreate(MerekBase):
    pass

class MerekRead(MerekBase):
    kd_merek: int

    class Config:
        from_attributes = True