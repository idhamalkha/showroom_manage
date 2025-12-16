from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.repositories.payroll_repository import get_all, get_by_id, create, update, delete, generate_monthly_payroll
from app.schemas.payroll import PayrollCreate, PayrollRead
from datetime import date, datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payroll", tags=["payroll"])

@router.get("/", response_model=List[PayrollRead])
def list_payrolls(db: Session = Depends(get_db)):
    return get_all(db)

@router.get("/{kd_payroll}", response_model=PayrollRead)
def get_payroll(kd_payroll: int, db: Session = Depends(get_db)):
    obj = get_by_id(db, kd_payroll)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.post("/", response_model=PayrollCreate)
def create_payroll(payload: PayrollCreate, db: Session = Depends(get_db)):
    return create(db, payload.dict())

@router.put("/{kd_payroll}", response_model=PayrollRead)
def update_payroll(kd_payroll: int, payload: PayrollCreate, db: Session = Depends(get_db)):
    obj = update(db, kd_payroll, payload.dict())
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.delete("/{kd_payroll}", response_model=dict)
def delete_payroll(kd_payroll: int, db: Session = Depends(get_db)):
    ok = delete(db, kd_payroll)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@router.post("/generate/monthly")
def generate_monthly_payroll_endpoint(periode: str = None, db: Session = Depends(get_db)):
    """
    Generate payroll untuk semua karyawan untuk periode tertentu.
    
    Jika periode tidak diberikan, akan menggunakan tanggal 1 bulan ini.
    Format periode: YYYY-MM-DD (misal: 2025-12-01)
    
    Returns:
        {
            'success': int,
            'skipped': int,
            'error': int,
            'payrolls': [list of kd_payroll],
            'errors': [list of error messages],
            'periode': str
        }
    """
    try:
        # Parse periode
        if periode:
            periode_date = datetime.strptime(periode, "%Y-%m-%d").date()
        else:
            # Default ke tanggal 1 bulan ini
            today = date.today()
            periode_date = date(today.year, today.month, 1)
        
        logger.info(f"Generating payroll for periode: {periode_date}")
        
        # Generate payroll
        result = generate_monthly_payroll(db, periode_date)
        result['periode'] = periode_date.strftime("%Y-%m-%d")
        
        return result
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(ve)}")
    except Exception as e:
        logger.error(f"Error in generate_monthly_payroll_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating payroll: {str(e)}")
