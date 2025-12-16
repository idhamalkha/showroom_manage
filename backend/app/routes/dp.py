from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.dp import DP
from datetime import date

router = APIRouter(prefix="/dp", tags=["DP"])

@router.post("/transaksi/{kd_transaksi}/dp", status_code=201)
def create_dp_for_transaksi(kd_transaksi: int, jumlah: float, tanggal: date, db: Session = Depends(get_db)):
    try:
        obj = DP(kd_transaksi=kd_transaksi, jumlah=jumlah, tanggal=tanggal, status='paid')
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return {"kd_dp": obj.kd_dp, "kd_transaksi": obj.kd_transaksi, "jumlah": float(obj.jumlah), "tanggal": str(obj.tanggal)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create DP")
