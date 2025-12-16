from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database.connection import get_db
from ..repositories.notifikasi_repository import NotifikasiRepository
from datetime import datetime

router = APIRouter(prefix="/notifikasi", tags=["Notifikasi"])

class NotifikasiSchema:
    def __init__(self, notifikasi):
        self.kd_notifikasi = notifikasi.kd_notifikasi
        self.kd_karyawan = notifikasi.kd_karyawan
        self.tipe_notifikasi = notifikasi.tipe_notifikasi.value
        self.judul = notifikasi.judul
        self.pesan = notifikasi.pesan
        self.referensi_id = notifikasi.referensi_id
        self.referensi_tipe = notifikasi.referensi_tipe
        self.is_read = notifikasi.is_read
        self.created_at = notifikasi.created_at
        self.read_at = notifikasi.read_at

@router.get("/unread-count")
def get_unread_count(
    kd_karyawan: int,
    db: Session = Depends(get_db)
):
    """Mendapatkan jumlah notifikasi yang belum dibaca"""
    repo = NotifikasiRepository(db)
    count = repo.get_unread_count(kd_karyawan)
    return {"unread_count": count}

@router.get("/unread")
def get_unread_notifications(
    kd_karyawan: int,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Mendapatkan notifikasi yang belum dibaca"""
    repo = NotifikasiRepository(db)
    notifications = repo.get_unread_notifications(kd_karyawan, limit)
    return {
        "count": len(notifications),
        "notifications": [
            {
                "kd_notifikasi": n.kd_notifikasi,
                "tipe_notifikasi": n.tipe_notifikasi.value,
                "judul": n.judul,
                "pesan": n.pesan,
                "referensi_id": n.referensi_id,
                "referensi_tipe": n.referensi_tipe,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ]
    }

@router.get("/all")
def get_all_notifications(
    kd_karyawan: int,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Mendapatkan semua notifikasi (read & unread)"""
    repo = NotifikasiRepository(db)
    notifications = repo.get_all_notifications(kd_karyawan, limit, offset)
    return {
        "count": len(notifications),
        "notifications": [
            {
                "kd_notifikasi": n.kd_notifikasi,
                "tipe_notifikasi": n.tipe_notifikasi.value,
                "judul": n.judul,
                "pesan": n.pesan,
                "referensi_id": n.referensi_id,
                "referensi_tipe": n.referensi_tipe,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "read_at": n.read_at.isoformat() if n.read_at else None,
            }
            for n in notifications
        ]
    }

@router.put("/{kd_notifikasi}/read")
def mark_notification_as_read(
    kd_notifikasi: int,
    db: Session = Depends(get_db)
):
    """Mark notifikasi sebagai sudah dibaca"""
    repo = NotifikasiRepository(db)
    notifikasi = repo.mark_as_read(kd_notifikasi)
    
    if not notifikasi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notifikasi tidak ditemukan"
        )
    
    return {
        "success": True,
        "message": "Notifikasi sudah ditandai sebagai terbaca",
        "kd_notifikasi": notifikasi.kd_notifikasi,
        "read_at": notifikasi.read_at.isoformat() if notifikasi.read_at else None,
    }

@router.put("/read-all")
def mark_all_as_read(
    kd_karyawan: int,
    db: Session = Depends(get_db)
):
    """Mark semua notifikasi sebagai sudah dibaca"""
    repo = NotifikasiRepository(db)
    repo.mark_all_as_read(kd_karyawan)
    return {
        "success": True,
        "message": "Semua notifikasi sudah ditandai sebagai terbaca"
    }

@router.delete("/{kd_notifikasi}")
def delete_notification(
    kd_notifikasi: int,
    db: Session = Depends(get_db)
):
    """Menghapus notifikasi"""
    repo = NotifikasiRepository(db)
    success = repo.delete_notification(kd_notifikasi)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notifikasi tidak ditemukan"
        )
    
    return {"success": True, "message": "Notifikasi sudah dihapus"}
