from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database.connection import get_db
from app.models.cuti_histori import CutiHistori
from app.models.karyawan import Karyawan
from app.models.notifikasi import NotificationType
from app.repositories.cuti_histori_repository import get_all, get_by_id, create, update, delete
from app.repositories.notifikasi_repository import NotifikasiRepository
from app.schemas.cuti_histori import CutiHistoriCreate, CutiHistoriRead
from app.routes.auth import get_current_user
from app.models.jabatan import Jabatan

router = APIRouter(prefix="/cuti", tags=["cuti"])

@router.get("/", response_model=List[CutiHistoriRead])
def list_cuti(db: Session = Depends(get_db)):
    return get_all(db)

@router.get("/{kd_cuti}", response_model=CutiHistoriRead)
def get_cuti(kd_cuti: int, db: Session = Depends(get_db)):
    obj = get_by_id(db, kd_cuti)
    if not obj:
        raise HTTPException(status_code=404, detail="Cuti not found")
    return obj

@router.post("/", response_model=CutiHistoriRead)
def create_cuti(payload: CutiHistoriCreate, db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    # Calculate durasi_hari from dates
    data = payload.dict()
    durasi = (data['tgl_selesai'] - data['tgl_mulai']).days + 1  # Include both start and end day
    data['durasi_hari'] = durasi
    data['kd_karyawan'] = current_user.kd_karyawan
    data['status'] = 'pending'  # Always set to pending initially
    cuti = create(db, data)
    
    # Create notification for HRD
    try:
        notif_repo = NotifikasiRepository(db)
        
        # Get HRD users via jabatan relationship
        hrd_users = db.query(Karyawan).join(Jabatan).filter(
            (Jabatan.nama_jabatan.ilike('%hrd%')) | (Jabatan.nama_jabatan.ilike('%hr%'))
        ).all()
        
        # Create notification for each HRD
        for hrd in hrd_users:
            notif_repo.create_notifikasi(
                kd_karyawan=hrd.kd_karyawan,
                tipe_notifikasi=NotificationType.CUTI_PENDING,
                judul=f"Pengajuan Cuti Baru dari {current_user.nama_karyawan}",
                pesan=f"Karyawan {current_user.nama_karyawan} telah mengajukan cuti dari {data['tgl_mulai']} hingga {data['tgl_selesai']} ({durasi} hari). Alasan: {data.get('alasan', '-')}",
                referensi_id=cuti.kd_cuti,
                referensi_tipe="cuti"
            )
    except Exception as e:
        print(f"Error creating HRD notification: {e}")
    
    return cuti

@router.get("/pending/all")
def get_pending_cuti(db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    """Get all pending cuti requests (use /hrd/cuti/pending instead)"""
    # This endpoint is deprecated - use /hrd/cuti/pending instead
    pending = db.query(CutiHistori).filter(CutiHistori.status == 'pending').all()
    return pending

@router.put("/{kd_cuti}", response_model=CutiHistoriRead)
def update_cuti(kd_cuti: int, payload: CutiHistoriCreate, db: Session = Depends(get_db)):
    obj = update(db, kd_cuti, payload.dict())
    if not obj:
        raise HTTPException(status_code=404, detail="Cuti not found")
    return obj

@router.delete("/{kd_cuti}", response_model=dict)
def delete_cuti(kd_cuti: int, db: Session = Depends(get_db)):
    ok = delete(db, kd_cuti)
    if not ok:
        raise HTTPException(status_code=404, detail="Cuti not found")
    return {"ok": True}