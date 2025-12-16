import logging
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_, or_
from datetime import datetime, timedelta
from app.models import CicilanSchedule, Cicilan, Payment, Transaksi

logger = logging.getLogger(__name__)


class CicilanRepository:
    """Repository untuk handle cicilan schedule dan tracking"""

    def __init__(self, db: Session):
        self.db = db
        self.logger = logger

    def generate_cicilan_schedule(self, kd_cicilan: int, jumlah_cicilan: float = None, tenor: int = None, tgl_mulai: str = None):
        """
        Generate jadwal cicilan otomatis berdasarkan cicilan header.
        Cicilan dimulai 30 hari setelah tanggal transaksi.
        
        Args:
            kd_cicilan: ID cicilan
            jumlah_cicilan: Total jumlah cicilan (optional, ambil dari model jika tidak ada)
            tenor: Jumlah bulan cicilan (optional, ambil dari model jika tidak ada)
            tgl_mulai: Tanggal mulai cicilan (optional, hitung dari transaksi + 30 hari)
        """
        try:
            cicilan = self.db.query(Cicilan).filter(Cicilan.kd_cicilan == kd_cicilan).first()
            if not cicilan:
                raise ValueError(f"Cicilan {kd_cicilan} tidak ditemukan")

            # Get nilai dari cicilan model jika tidak disediakan
            if jumlah_cicilan is None:
                jumlah_cicilan = float(cicilan.jumlah_cicilan or 0)
            if tenor is None:
                tenor = cicilan.tenor or 12

            # Hitung tgl_mulai: 30 hari setelah tanggal transaksi
            if tgl_mulai is None:
                if not cicilan.transaksi or not cicilan.transaksi.tanggal:
                    raise ValueError(f"Cicilan {kd_cicilan} tidak memiliki tanggal transaksi")
                tgl_mulai_date = cicilan.transaksi.tanggal + timedelta(days=30)
            else:
                tgl_mulai_date = datetime.strptime(tgl_mulai, "%Y-%m-%d").date()

            # Delete existing schedules if any
            self.db.query(CicilanSchedule).filter(CicilanSchedule.kd_cicilan == kd_cicilan).delete()

            # Calculate jumlah per cicilan
            jumlah_per_cicilan = jumlah_cicilan / tenor

            # Generate schedules - setiap bulan mulai dari tgl_mulai
            for i in range(1, tenor + 1):
                # Cicilan pertama jatuh tempo di akhir bulan pertama (tgl_mulai + 30 hari)
                # Cicilan kedua di akhir bulan kedua (tgl_mulai + 60 hari), dst
                jatuh_tempo = tgl_mulai_date + timedelta(days=30 * i)

                schedule = CicilanSchedule(
                    kd_cicilan=kd_cicilan,
                    nomor_cicilan=i,
                    jumlah=jumlah_per_cicilan,
                    tgl_jatuh_tempo=jatuh_tempo,
                    status="pending"
                )
                self.db.add(schedule)

            self.db.commit()
            self.logger.info(f"Generated {tenor} cicilan schedules untuk cicilan {kd_cicilan} starting {tgl_mulai_date}")
            return self.get_cicilan_schedules(kd_cicilan)

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error generating cicilan schedule: {str(e)}")
            raise

    def get_cicilan_schedules(self, kd_cicilan: int):
        """Get all schedules untuk satu cicilan"""
        try:
            schedules = (
                self.db.query(CicilanSchedule)
                .filter(CicilanSchedule.kd_cicilan == kd_cicilan)
                .order_by(CicilanSchedule.nomor_cicilan)
                .all()
            )
            return [
                {
                    "kd_schedule": s.kd_schedule,
                    "nomor_cicilan": s.nomor_cicilan,
                    "jumlah": float(s.jumlah or 0),
                    "tgl_jatuh_tempo": s.tgl_jatuh_tempo.isoformat(),
                    "status": s.status,
                    "tgl_pembayaran": s.tgl_pembayaran.isoformat() if s.tgl_pembayaran else None,
                    "is_overdue": datetime.now().date() > s.tgl_jatuh_tempo and s.status == "pending"
                }
                for s in schedules
            ]
        except Exception as e:
            self.logger.error(f"Error getting cicilan schedules: {str(e)}")
            return []

    def get_overdue_cicilan(self, limit: int = 50):
        """Get semua cicilan yang overdue (belum dibayar & jatuh tempo sudah lewat)"""
        try:
            today = datetime.now().date()
            overdue = (
                self.db.query(CicilanSchedule)
                .filter(
                    and_(
                        CicilanSchedule.status == "pending",
                        CicilanSchedule.tgl_jatuh_tempo < today
                    )
                )
                .order_by(CicilanSchedule.tgl_jatuh_tempo)
                .limit(limit)
                .all()
            )

            result = []
            for s in overdue:
                cicilan = self.db.query(Cicilan).filter(Cicilan.kd_cicilan == s.kd_cicilan).first()
                transaksi = cicilan.transaksi if cicilan else None
                client = transaksi.client if transaksi else None
                
                days_overdue = (today - s.tgl_jatuh_tempo).days
                
                result.append({
                    "kd_schedule": s.kd_schedule,
                    "kd_cicilan": s.kd_cicilan,
                    "kd_transaksi": transaksi.kd_transaksi if transaksi else None,
                    "kd_client": client.kd_client if client else None,
                    "nama_client": client.nama_client if client else "Unknown",
                    "username_client": client.username_client if client else None,
                    "nomor_cicilan": s.nomor_cicilan,
                    "jumlah": float(s.jumlah or 0),
                    "tgl_jatuh_tempo": s.tgl_jatuh_tempo.isoformat(),
                    "days_overdue": days_overdue,
                    "status": s.status
                })

            return result
        except Exception as e:
            self.logger.error(f"Error getting overdue cicilan: {str(e)}")
            return []

    def get_active_cicilan(self, limit: int = 100):
        """Get semua cicilan yang masih aktif (ada schedule pending)"""
        try:
            # Get all cicilan yang punya schedule pending
            active_cicilans = (
                self.db.query(Cicilan)
                .join(Cicilan.schedules)
                .filter(CicilanSchedule.status == "pending")
                .distinct()
                .limit(limit)
                .all()
            )

            result = []
            for cicilan in active_cicilans:
                transaksi = cicilan.transaksi
                client = transaksi.client if transaksi else None
                
                # Hitung stats untuk cicilan ini
                schedules = self.db.query(CicilanSchedule).filter(
                    CicilanSchedule.kd_cicilan == cicilan.kd_cicilan
                ).all()
                
                total_amount = sum(float(s.jumlah or 0) for s in schedules)
                paid_count = len([s for s in schedules if s.status == "paid"])
                pending_count = len([s for s in schedules if s.status == "pending"])
                
                result.append({
                    "kd_cicilan": cicilan.kd_cicilan,
                    "kd_transaksi": transaksi.kd_transaksi if transaksi else None,
                    "kd_client": client.kd_client if client else None,
                    "nama_client": client.nama_client if client else "Unknown",
                    "total_cicilan": cicilan.tenor,
                    "total_amount": total_amount,
                    "paid_count": paid_count,
                    "pending_count": pending_count,
                    "progress_percentage": int((paid_count / (paid_count + pending_count) * 100)) if (paid_count + pending_count) > 0 else 0,
                    "tgl_transaksi": transaksi.tanggal.isoformat() if transaksi and transaksi.tanggal else None
                })

            return result
        except Exception as e:
            self.logger.error(f"Error getting active cicilan: {str(e)}")
            return []

    def mark_cicilan_paid(self, kd_schedule: int, kd_payment: int, tgl_pembayaran: str = None):
        """Mark cicilan schedule as paid and link ke payment"""
        try:
            schedule = self.db.query(CicilanSchedule).filter(CicilanSchedule.kd_schedule == kd_schedule).first()
            if not schedule:
                raise ValueError(f"Schedule {kd_schedule} tidak ditemukan")

            schedule.status = "paid"
            schedule.kd_payment = kd_payment
            schedule.tgl_pembayaran = datetime.strptime(tgl_pembayaran, "%Y-%m-%d").date() if tgl_pembayaran else datetime.now().date()
            schedule.updated_at = datetime.now()

            self.db.commit()
            self.logger.info(f"Marked cicilan schedule {kd_schedule} as paid")
            return True
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error marking cicilan as paid: {str(e)}")
            raise

    def get_cicilan_summary_by_client(self, kd_client: int):
        """Get summary cicilan untuk satu client"""
        try:
            # Get all cicilan for this client via transaksi
            cicilans = (
                self.db.query(Cicilan)
                .join(Cicilan.transaksi)
                .filter(Transaksi.kd_client == kd_client)
                .all()
            )

            total_outstanding = 0
            total_pending = 0
            overdue_count = 0
            paid_count = 0

            for c in cicilans:
                schedules = self.db.query(CicilanSchedule).filter(CicilanSchedule.kd_cicilan == c.kd_cicilan).all()
                for s in schedules:
                    if s.status == "pending":
                        total_outstanding += float(s.jumlah or 0)
                        total_pending += 1
                        if datetime.now().date() > s.tgl_jatuh_tempo:
                            overdue_count += 1
                    elif s.status == "paid":
                        paid_count += 1

            return {
                "kd_client": kd_client,
                "total_outstanding": total_outstanding,
                "total_pending_cicilan": total_pending,
                "total_overdue": overdue_count,
                "total_paid": paid_count
            }
        except Exception as e:
            self.logger.error(f"Error getting cicilan summary: {str(e)}")
            return {}
