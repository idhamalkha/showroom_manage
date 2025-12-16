from pydantic import BaseModel

class KontrakOut(BaseModel):
    kd_kontrak: int
    masa_kontrak: str

    class Config:
        from_attributes = True  # Untuk FastAPI v2, ganti dari orm_mode