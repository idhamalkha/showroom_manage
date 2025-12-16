import logging
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from app.models import CustomerCreditProfile, Client, Cicilan, CicilanSchedule, Transaksi, Invoice, Payment

logger = logging.getLogger(__name__)


class CustomerCreditRepository:
    """Repository untuk handle customer credit profiling dan payment history"""

    def __init__(self, db: Session):
        self.db = db
        self.logger = logger

    def get_or_create_credit_profile(self, kd_client: int):
        """Get atau create credit profile untuk customer"""
        try:
            profile = (
                self.db.query(CustomerCreditProfile)
                .filter(CustomerCreditProfile.kd_client == kd_client)
                .first()
            )

            if not profile:
                # Create default profile
                profile = CustomerCreditProfile(
                    kd_client=kd_client,
                    credit_limit=500000000,  # Default 500M
                    total_outstanding=0,
                    payment_score=100,
                    total_transaksi=0,
                    total_bayar_tepat=0,
                    total_telat=0,
                    is_blacklist=False
                )
                self.db.add(profile)
                self.db.commit()
                self.logger.info(f"Created credit profile for client {kd_client}")

            return profile
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error getting/creating credit profile: {str(e)}")
            raise

    def update_payment_history(self, kd_client: int):
        """
        Update payment history berdasarkan cicilan yang sudah lunas.
        Hitung:
        - Total transaksi
        - Total bayar tepat waktu
        - Total telat
        - Payment score
        """
        try:
            profile = self.get_or_create_credit_profile(kd_client)

            # Get all paid schedules untuk client ini
            paid_schedules = (
                self.db.query(CicilanSchedule)
                .join(CicilanSchedule.cicilan)
                .join(Cicilan.transaksi)
                .filter(
                    Transaksi.kd_client == kd_client,
                    CicilanSchedule.status == "paid"
                )
                .all()
            )

            total_bayar_tepat = 0
            total_telat = 0

            for schedule in paid_schedules:
                # Handle None values in date comparison
                if schedule.tgl_pembayaran and schedule.tgl_jatuh_tempo:
                    if schedule.tgl_pembayaran <= schedule.tgl_jatuh_tempo:
                        total_bayar_tepat += 1
                    else:
                        total_telat += 1
                elif schedule.tgl_pembayaran:  # If tgl_jatuh_tempo is None, consider it on-time
                    total_bayar_tepat += 1

            # Get total transaksi untuk client
            total_transaksi = self.db.query(func.count(Transaksi.kd_transaksi)).filter(
                Transaksi.kd_client == kd_client
            ).scalar() or 0

            # Update profile
            profile.total_transaksi = total_transaksi
            profile.total_bayar_tepat = total_bayar_tepat
            profile.total_telat = total_telat
            profile.payment_score = profile.calculate_payment_score()

            # Update total outstanding (cicilan yang belum dibayar)
            pending_schedules = (
                self.db.query(func.sum(CicilanSchedule.jumlah))
                .join(CicilanSchedule.cicilan)
                .join(Cicilan.transaksi)
                .filter(
                    Transaksi.kd_client == kd_client,
                    CicilanSchedule.status == "pending"
                )
                .scalar()
            )
            profile.total_outstanding = float(pending_schedules or 0)

            self.db.commit()
            self.logger.info(f"Updated payment history for client {kd_client}")
            return profile

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error updating payment history: {str(e)}")
            raise

    def get_payment_history(self, kd_client: int, limit: int = 50):
        """Get payment history untuk satu client"""
        try:
            history = (
                self.db.query(CicilanSchedule)
                .join(CicilanSchedule.cicilan)
                .join(Cicilan.transaksi)
                .filter(Transaksi.kd_client == kd_client)
                .order_by(desc(CicilanSchedule.created_at))
                .limit(limit)
                .all()
            )

            result = []
            for s in history:
                transaksi = s.cicilan.transaksi
                days_late = 0
                if s.status == "paid" and s.tgl_pembayaran:
                    days_late = (s.tgl_pembayaran - s.tgl_jatuh_tempo).days
                elif s.status == "overdue":
                    days_late = (datetime.now().date() - s.tgl_jatuh_tempo).days

                result.append({
                    "kd_schedule": s.kd_schedule,
                    "nomor_cicilan": s.nomor_cicilan,
                    "jumlah": float(s.jumlah or 0),
                    "tgl_jatuh_tempo": s.tgl_jatuh_tempo.isoformat(),
                    "tgl_pembayaran": s.tgl_pembayaran.isoformat() if s.tgl_pembayaran else None,
                    "status": s.status,
                    "days_late": days_late,
                    "kd_transaksi": transaksi.kd_transaksi
                })

            return result
        except Exception as e:
            self.logger.error(f"Error getting payment history: {str(e)}")
            return []

    def get_credit_profile_detail(self, kd_client: int):
        """Get detail credit profile dengan semua info"""
        try:
            profile = self.get_or_create_credit_profile(kd_client)
            
            # Update history dulu
            profile = self.update_payment_history(kd_client)

            # Get client info
            client = self.db.query(Client).filter(Client.kd_client == kd_client).first()

            return {
                "kd_profile": profile.kd_profile,
                "kd_client": profile.kd_client,
                "nama_client": client.nama_client if client else "Unknown",
                "credit_limit": float(profile.credit_limit or 0),
                "total_outstanding": float(profile.total_outstanding or 0),
                "available_credit": float((profile.credit_limit or 0) - (profile.total_outstanding or 0)),
                "payment_score": float(profile.payment_score or 0),
                "total_transaksi": profile.total_transaksi,
                "total_bayar_tepat": profile.total_bayar_tepat,
                "total_telat": profile.total_telat,
                "is_blacklist": profile.is_blacklist,
                "alasan_blacklist": profile.alasan_blacklist,
                "ontime_percentage": (profile.total_bayar_tepat / profile.total_transaksi * 100) if profile.total_transaksi > 0 else 0
            }
        except Exception as e:
            self.logger.error(f"Error getting credit profile detail: {str(e)}")
            return {}

    def set_credit_limit(self, kd_client: int, credit_limit: float):
        """Set credit limit untuk client"""
        try:
            profile = self.get_or_create_credit_profile(kd_client)
            profile.credit_limit = credit_limit
            self.db.commit()
            self.logger.info(f"Set credit limit for client {kd_client} to {credit_limit}")
            return True
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error setting credit limit: {str(e)}")
            raise

    def blacklist_customer(self, kd_client: int, alasan: str):
        """Blacklist customer (e.g., sering telat atau default)"""
        try:
            profile = self.get_or_create_credit_profile(kd_client)
            profile.is_blacklist = True
            profile.alasan_blacklist = alasan
            self.db.commit()
            self.logger.warning(f"Customer {kd_client} blacklisted: {alasan}")
            return True
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error blacklisting customer: {str(e)}")
            raise

    def whitelist_customer(self, kd_client: int):
        """Remove blacklist untuk customer"""
        try:
            profile = self.get_or_create_credit_profile(kd_client)
            profile.is_blacklist = False
            profile.alasan_blacklist = None
            self.db.commit()
            self.logger.info(f"Customer {kd_client} whitelisted")
            return True
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error whitelisting customer: {str(e)}")
            raise

    def get_high_risk_customers(self, limit: int = 20):
        """Get customers dengan payment score rendah atau sering telat"""
        try:
            profiles = (
                self.db.query(CustomerCreditProfile)
                .order_by(
                    CustomerCreditProfile.is_blacklist.desc(),
                    CustomerCreditProfile.payment_score.asc()
                )
                .limit(limit)
                .all()
            )

            result = []
            for p in profiles:
                client = self.db.query(Client).filter(Client.kd_client == p.kd_client).first()
                result.append({
                    "kd_client": p.kd_client,
                    "nama_client": client.nama_client if client else "Unknown",
                    "payment_score": float(p.payment_score or 0),
                    "total_telat": p.total_telat,
                    "is_blacklist": p.is_blacklist,
                    "total_outstanding": float(p.total_outstanding or 0)
                })

            return result
        except Exception as e:
            self.logger.error(f"Error getting high risk customers: {str(e)}")
            return []
