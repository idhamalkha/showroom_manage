from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, time
from pydantic import BaseModel
from app.database.connection import get_db
from app.models.absensi_histori import AbsensiHistori
from app.models.karyawan import Karyawan
from app.models.notifikasi import NotificationType
from app.repositories.absensi_histori_repository import AbsensiHistoriRepository
from app.repositories.notifikasi_repository import NotifikasiRepository
from app.routes.auth import get_current_user
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/absensi", tags=["absensi"])

# Pydantic schema for request body
class AbsensiCreate(BaseModel):
    tgl_absensi: date
    status: str = "hadir"
    keterangan: Optional[str] = None

@router.post("/")
def record_attendance(
    payload: AbsensiCreate,
    db: Session = Depends(get_db),
    current_user: Karyawan = Depends(get_current_user)
):
    """Record attendance for employee"""
    
    # Validate status
    valid_status = ["hadir", "absen", "izin", "sakit"]
    if payload.status not in valid_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status harus salah satu dari: {', '.join(valid_status)}"
        )
    
    kd_karyawan = current_user.kd_karyawan
    
    try:
        # Check cutoff time - only allow hadir recording before 8am
        if payload.status == "hadir":
            current_time = datetime.now().time()
            cutoff_time = time(8, 0, 0)  # 8:00 AM
            
            if current_time >= cutoff_time:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Waktu pencatatan kehadiran sudah terlewat (batas: jam 08:00). Anda sudah dianggap absen."
                )
        
        # Check if already recorded today
        existing = db.query(AbsensiHistori).filter(
            AbsensiHistori.kd_karyawan == kd_karyawan,
            AbsensiHistori.tgl_absensi == payload.tgl_absensi
        ).first()
        
        if existing and existing.status == payload.status:
            # Already recorded with same status - return success
            return {
                "success": True,
                "message": f"Anda sudah tercatat sebagai {payload.status} pada {payload.tgl_absensi}",
                "already_recorded": True,
                "data": {
                    "kd_absensi": existing.kd_absensi,
                    "kd_karyawan": existing.kd_karyawan,
                    "tgl_absensi": existing.tgl_absensi,
                    "status": existing.status,
                    "keterangan": existing.keterangan,
                    "created_at": existing.created_at
                }
            }
        
        # Get or create attendance record
        absensi = AbsensiHistoriRepository.get_or_create(
            db,
            kd_karyawan=kd_karyawan,
            tgl_absensi=payload.tgl_absensi,
            status=payload.status,
            keterangan=payload.keterangan
        )
        
        if not absensi:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal mencatat absensi"
            )
        
        # Create notification if recorded as hadir
        if payload.status == "hadir":
            try:
                notif_repo = NotifikasiRepository(db)
                karyawan = current_user
                
                # Get HRD users for notification via jabatan relationship
                from app.models.jabatan import Jabatan
                hrd_users = db.query(Karyawan).join(Jabatan).filter(
                    Jabatan.nama_jabatan.ilike('%hrd%') | Jabatan.nama_jabatan.ilike('%hr%')
                ).all()
                
                # Create notification for each HRD
                for hrd in hrd_users:
                    notif_repo.create_notifikasi(
                        kd_karyawan=hrd.kd_karyawan,
                        tipe_notifikasi=NotificationType.HADIR_RECORDED,
                        judul=f"Kehadiran Tercatat - {karyawan.nama_karyawan if karyawan else 'Karyawan'}",
                        pesan=f"Karyawan {karyawan.nama_karyawan if karyawan else 'Unknown'} telah mencatat kehadiran pada {payload.tgl_absensi} pukul {datetime.now().strftime('%H:%M')}",
                        referensi_id=absensi.kd_absensi,
                        referensi_tipe="absensi"
                    )
            except Exception as notif_err:
                print(f"Error creating HRD notification for absensi: {notif_err}")
                db.rollback()
        
        return {
            "success": True,
            "message": f"Absensi tercatat sebagai {payload.status}",
            "already_recorded": False,
            "data": {
                "kd_absensi": absensi.kd_absensi,
                "kd_karyawan": absensi.kd_karyawan,
                "tgl_absensi": absensi.tgl_absensi,
                "status": absensi.status,
                "keterangan": absensi.keterangan,
                "created_at": absensi.created_at
            }
        }
    
    except IntegrityError as e:
        db.rollback()
        # Handle duplicate entry gracefully
        return {
            "success": True,
            "message": f"Anda sudah tercatat untuk hari ini",
            "already_recorded": True,
            "warning": "Tidak dapat membuat entri ganda untuk hari yang sama"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

@router.get("/month")
def get_monthly_attendance(
    tahun: int,
    bulan: int,
    db: Session = Depends(get_db),
    current_user: Karyawan = Depends(get_current_user)
):
    """Get attendance records for a specific month"""
    
    kd_karyawan = current_user.kd_karyawan
    
    try:
        records = AbsensiHistoriRepository.get_attendance_for_month(
            db,
            kd_karyawan=kd_karyawan,
            year=tahun,
            month=bulan
        )
        
        summary = {
            "hadir": 0,
            "absen": 0,
            "izin": 0,
            "sakit": 0
        }
        
        for record in records:
            summary[record.status] += 1
        
        return {
            "success": True,
            "tahun": tahun,
            "bulan": bulan,
            "summary": summary,
            "total": len(records),
            "records": [
                {
                    "kd_absensi": r.kd_absensi,
                    "tgl_absensi": r.tgl_absensi,
                    "status": r.status,
                    "keterangan": r.keterangan
                }
                for r in records
            ]
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

@router.get("/record/{kd_absensi}")
def get_attendance_record(
    kd_absensi: int,
    db: Session = Depends(get_db),
    current_user: Karyawan = Depends(get_current_user)
):
    """Get specific attendance record"""
    
    absensi = db.query(AbsensiHistori).filter(
        AbsensiHistori.kd_absensi == kd_absensi
    ).first()
    
    if not absensi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Absensi tidak ditemukan"
        )
    
    # Check if user is the employee or is HRD
    kd_karyawan = current_user.kd_karyawan
    if absensi.kd_karyawan != kd_karyawan:
        # Check if user is HRD
        if not current_user.jabatan or 'hrd' not in current_user.jabatan.nama_jabatan.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anda tidak memiliki akses ke record ini"
            )
    
    return {
        "success": True,
        "data": {
            "kd_absensi": absensi.kd_absensi,
            "kd_karyawan": absensi.kd_karyawan,
            "tgl_absensi": absensi.tgl_absensi,
            "status": absensi.status,
            "keterangan": absensi.keterangan,
            "created_at": absensi.created_at,
            "updated_at": absensi.updated_at
        }
    }

@router.post("/auto-absent")
def trigger_auto_absent(
    db: Session = Depends(get_db),
    current_user: Karyawan = Depends(get_current_user)
):
    """Trigger auto-absent marking for employees who didn't record attendance by 8am"""
    
    # Only allow HRD to trigger this
    if not current_user.jabatan or 'hrd' not in current_user.jabatan.nama_jabatan.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya HRD yang dapat menjalankan auto-absent"
        )
    
    result = AbsensiHistoriRepository.auto_mark_absent_after_8am(db)
    return result
