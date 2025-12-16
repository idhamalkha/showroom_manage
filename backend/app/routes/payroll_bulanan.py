from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date
from app.database.connection import get_db
from app.models import PayrollBulanan
from app.repositories.payroll_bulanan_repository import PayrollBulananRepository
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/payroll-bulanan", tags=["Payroll Bulanan"])
repo = PayrollBulananRepository()


class PayrollBulananResponse(BaseModel):
    kd_payroll_bulanan: int
    kd_karyawan: int
    periode: date
    gaji_pokok: float
    bonus: float
    lembur: float
    tunjangan_lainnya: float
    potongan_absen: float
    potongan_pajak: float
    potongan_asuransi: float
    potongan_lainnya: float
    jumlah_hari_kerja: Optional[int]
    jumlah_absen: Optional[int]
    jumlah_jam_lembur: Optional[float]
    total_penerimaan: float
    total_potongan: float
    total_gaji: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PayrollBulananCreateRequest(BaseModel):
    kd_karyawan: int
    periode: date
    gaji_pokok: float = 0
    bonus: float = 0
    lembur: float = 0
    tunjangan_lainnya: float = 0
    potongan_absen: float = 0
    potongan_pajak: float = 0
    potongan_asuransi: float = 0
    potongan_lainnya: float = 0
    jumlah_hari_kerja: Optional[int] = 0
    jumlah_absen: Optional[int] = 0
    jumlah_jam_lembur: Optional[float] = 0
    status: str = 'draft'


class GeneratePayrollRequest(BaseModel):
    periode: Optional[date] = None


@router.get("/{kd_karyawan}/{periode}", response_model=Optional[PayrollBulananResponse])
async def get_payroll(kd_karyawan: int, periode: str, db: Session = Depends(get_db)):
    """Get payroll for specific karyawan and periode"""
    try:
        periode_date = datetime.strptime(periode, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid periode format. Use YYYY-MM-DD")
    
    payroll = repo.get_payroll_by_karyawan_periode(db, kd_karyawan, periode_date)
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    return payroll


@router.get("/periode/{periode}", response_model=List[PayrollBulananResponse])
async def get_payroll_by_periode(periode: str, db: Session = Depends(get_db)):
    """Get all payroll records for a specific periode"""
    try:
        periode_date = datetime.strptime(periode, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid periode format. Use YYYY-MM-DD")
    
    payrolls = repo.get_payroll_by_periode(db, periode_date)
    return payrolls


@router.post("/generate", response_model=dict)
async def generate_payroll(
    request: GeneratePayrollRequest = None,
    db: Session = Depends(get_db)
):
    """
    Generate monthly payroll for all karyawan
    
    IMPORTANT: Payroll akan digenerate untuk AKHIR BULAN (tanggal 30/31)
    untuk memastikan semua data transaksi, lembur, absen sudah lengkap.
    
    Parameters:
    - periode: Date string in YYYY-MM-DD format (optional, defaults to last day of current month)
    
    Examples:
    - POST /payroll-bulanan/generate (gajian akhir bulan ini)
    - POST /payroll-bulanan/generate?periode=2025-12-15 (akan convert ke 2025-12-31)
    """
    try:
        if request and request.periode:
            periode = request.periode
        else:
            # Default to last day of current month
            from calendar import monthrange
            today = datetime.now().date()
            last_day = monthrange(today.year, today.month)[1]
            periode = date(today.year, today.month, last_day)
        
        result = repo.generate_monthly_payroll(db, periode)
        
        return {
            "success": True,
            "periode": periode.isoformat(),
            "note": "Payroll generated untuk akhir bulan (semua data transaksi sudah lengkap)",
            "stats": {
                "success": result["success"],
                "skipped": result["skipped"],
                "error": result["error"]
            },
            "errors": result["errors"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating payroll: {str(e)}")


@router.patch("/{kd_payroll_bulanan}/status", response_model=PayrollBulananResponse)
async def update_payroll_status(
    kd_payroll_bulanan: int,
    status: str = Query(..., description="New status: draft, approved, or paid"),
    db: Session = Depends(get_db)
):
    """Update payroll status"""
    if status not in ['draft', 'approved', 'paid']:
        raise HTTPException(status_code=400, detail="Invalid status. Must be draft, approved, or paid")
    
    payroll = repo.update_payroll_status(db, kd_payroll_bulanan, status)
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    return payroll


@router.get("", response_model=List[PayrollBulananResponse])
async def get_all_payroll(
    kd_karyawan: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get all payroll records with optional filters
    
    Query parameters:
    - kd_karyawan: Filter by employee ID (optional)
    - status: Filter by status (draft, approved, paid) (optional)
    """
    query = db.query(PayrollBulanan)
    
    if kd_karyawan:
        query = query.filter(PayrollBulanan.kd_karyawan == kd_karyawan)
    
    if status:
        query = query.filter(PayrollBulanan.status == status)
    
    payrolls = query.order_by(PayrollBulanan.periode.desc()).all()
    return payrolls
