from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from ..models import Notifikasi, NotificationType
from .base_repository import BaseRepository
from datetime import datetime

class NotifikasiRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Notifikasi, db)

    def create_notifikasi(
        self,
        kd_karyawan: int,
        tipe_notifikasi: NotificationType,
        judul: str,
        pesan: str = "",
        referensi_id: int = None,
        referensi_tipe: str = None
    ) -> Notifikasi:
        """Membuat notifikasi baru"""
        notifikasi = Notifikasi(
            kd_karyawan=kd_karyawan,
            tipe_notifikasi=tipe_notifikasi,
            judul=judul,
            pesan=pesan,
            referensi_id=referensi_id,
            referensi_tipe=referensi_tipe,
            is_read=False
        )
        self.db.add(notifikasi)
        self.db.commit()
        self.db.refresh(notifikasi)
        return notifikasi

    def get_unread_count(self, kd_karyawan: int) -> int:
        """Mendapatkan jumlah notifikasi yang belum dibaca"""
        return self.db.query(Notifikasi).filter(
            and_(
                Notifikasi.kd_karyawan == kd_karyawan,
                Notifikasi.is_read == False
            )
        ).count()

    def get_unread_notifications(self, kd_karyawan: int, limit: int = 10) -> list:
        """Mendapatkan notifikasi yang belum dibaca"""
        return self.db.query(Notifikasi).filter(
            and_(
                Notifikasi.kd_karyawan == kd_karyawan,
                Notifikasi.is_read == False
            )
        ).order_by(desc(Notifikasi.created_at)).limit(limit).all()

    def get_all_notifications(self, kd_karyawan: int, limit: int = 20, offset: int = 0) -> list:
        """Mendapatkan semua notifikasi (read & unread)"""
        return self.db.query(Notifikasi).filter(
            Notifikasi.kd_karyawan == kd_karyawan
        ).order_by(desc(Notifikasi.created_at)).offset(offset).limit(limit).all()

    def mark_as_read(self, kd_notifikasi: int) -> Notifikasi:
        """Mark notifikasi sebagai sudah dibaca"""
        notifikasi = self.get_by_id(kd_notifikasi)
        if notifikasi:
            notifikasi.mark_as_read()
            self.db.commit()
            self.db.refresh(notifikasi)
        return notifikasi

    def mark_all_as_read(self, kd_karyawan: int) -> bool:
        """Mark semua notifikasi sebagai sudah dibaca"""
        self.db.query(Notifikasi).filter(
            and_(
                Notifikasi.kd_karyawan == kd_karyawan,
                Notifikasi.is_read == False
            )
        ).update({Notifikasi.is_read: True, Notifikasi.read_at: datetime.utcnow()})
        self.db.commit()
        return True

    def delete_notification(self, kd_notifikasi: int) -> bool:
        """Menghapus notifikasi"""
        return self.delete(kd_notifikasi)

    def get_by_referensi(self, referensi_id: int, referensi_tipe: str) -> list:
        """Mendapatkan notifikasi berdasarkan referensi (cuti_id, lembur_id, etc)"""
        return self.db.query(Notifikasi).filter(
            and_(
                Notifikasi.referensi_id == referensi_id,
                Notifikasi.referensi_tipe == referensi_tipe
            )
        ).all()
