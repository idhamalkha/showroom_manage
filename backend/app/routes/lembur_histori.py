from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database.connection import get_db
from app.models.lembur_histori import LemburHistori
from app.models.karyawan import Karyawan
from app.models.notifikasi import NotificationType
from app.repositories.lembur_histori_repository import get_all, get_by_id, create, update, delete
from app.repositories.notifikasi_repository import NotifikasiRepository
from app.schemas.lembur_histori import LemburHistoriCreate, LemburHistoriRead
from app.routes.auth import get_current_user
from app.models.jabatan import Jabatan

router = APIRouter(prefix="/lembur", tags=["lembur"])

@router.get("/", response_model=List[LemburHistoriRead])
def list_lembur(db: Session = Depends(get_db)):
    return get_all(db)

@router.get("/{kd_lembur}", response_model=LemburHistoriRead)
def get_lembur(kd_lembur: int, db: Session = Depends(get_db)):
    obj = get_by_id(db, kd_lembur)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.post("/", response_model=LemburHistoriRead)
def create_lembur(payload: LemburHistoriCreate, db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    data = payload.dict()
    data['kd_karyawan'] = current_user.kd_karyawan
    lembur = create(db, data)
    
    # Create notification for HRD
    try:
        notif_repo = NotifikasiRepository(db)
        
        # Get HRD users via jabatan relationship
        hrd_users = db.query(Karyawan).join(Jabatan).filter(
            Jabatan.nama_jabatan.ilike('%hrd%') | Jabatan.nama_jabatan.ilike('%hr%')
        ).all()
        
        # Create notification for each HRD
        for hrd in hrd_users:
            notif_repo.create_notifikasi(
                kd_karyawan=hrd.kd_karyawan,
                tipe_notifikasi=NotificationType.LEMBUR_PENDING,
                judul=f"Pengajuan Lembur Baru dari {current_user.nama_karyawan}",
                pesan=f"Karyawan {current_user.nama_karyawan} telah mengajukan lembur pada {data['tgl_lembur']} selama {data['jam_lembur']} jam",
                referensi_id=lembur.kd_lembur,
                referensi_tipe="lembur"
            )
    except Exception as e:
        print(f"Error creating HRD notification for lembur: {e}")
        db.rollback()
    
    return lembur

@router.get("/pending/all")
def get_pending_lembur(db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    """Get all pending lembur requests for HRD approval"""
    pending = db.query(LemburHistori).filter(LemburHistori.status == 'pending').all()
    return pending

@router.post("/{kd_lembur}/approve")
def approve_lembur(kd_lembur: int, db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    """Approve lembur request (HRD only)"""
    lembur = get_by_id(db, kd_lembur)
    if not lembur:
        raise HTTPException(status_code=404, detail="Lembur not found")
    
    # Update lembur status
    lembur.status = 'approved'
    lembur.approved_by = current_user.kd_karyawan
    lembur.approval_date = datetime.utcnow()
    db.commit()
    db.refresh(lembur)
    
    # Create notification for employee
    notif_repo = NotifikasiRepository(db)
    notif_repo.create_notifikasi(
        kd_karyawan=lembur.kd_karyawan,
        tipe_notifikasi=NotificationType.LEMBUR_APPROVED,
        judul="Pengajuan Lembur Disetujui",
        pesan=f"Pengajuan lembur Anda pada {lembur.tgl_lembur} selama {lembur.jam_lembur} jam telah disetujui oleh HRD.",
        referensi_id=lembur.kd_lembur,
        referensi_tipe="lembur"
    )
    
    return lembur

@router.post("/{kd_lembur}/reject")
def reject_lembur(kd_lembur: int, reason: Optional[str] = None, db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    """Reject lembur request (HRD only)"""
    lembur = get_by_id(db, kd_lembur)
    if not lembur:
        raise HTTPException(status_code=404, detail="Lembur not found")
    
    # Update lembur status
    lembur.status = 'rejected'
    lembur.approved_by = current_user.kd_karyawan
    lembur.approval_date = datetime.utcnow()
    if reason:
        lembur.alasan = reason
    db.commit()
    db.refresh(lembur)
    
    # Create notification for employee
    notif_repo = NotifikasiRepository(db)
    notif_repo.create_notifikasi(
        kd_karyawan=lembur.kd_karyawan,
        tipe_notifikasi=NotificationType.LEMBUR_REJECTED,
        judul="Pengajuan Lembur Ditolak",
        pesan=f"Pengajuan lembur Anda pada {lembur.tgl_lembur} selama {lembur.jam_lembur} jam telah ditolak. Alasan: {reason or 'Tidak ada keterangan'}",
        referensi_id=lembur.kd_lembur,
        referensi_tipe="lembur"
    )
    
    return lembur

@router.put("/{kd_lembur}", response_model=LemburHistoriRead)
def update_lembur(kd_lembur: int, payload: LemburHistoriCreate, db: Session = Depends(get_db)):
    obj = update(db, kd_lembur, payload.dict())
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj

@router.delete("/{kd_lembur}", response_model=dict)
def delete_lembur(kd_lembur: int, db: Session = Depends(get_db)):
    ok = delete(db, kd_lembur)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}