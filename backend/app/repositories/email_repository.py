"""
Email Repository - Handle database operations untuk email logs.
"""
from datetime import datetime, timedelta
from sqlalchemy import desc, and_
from sqlalchemy.orm import Session
from app.models.email_log import EmailLog


class EmailRepository:
    """Repository untuk mengelola email logs di database."""

    @staticmethod
    def create_email_log(
        db: Session,
        kd_schedule: int,
        kd_client: int,
        recipient_email: str,
        subject: str,
        email_type: str,
        status: str = 'pending',
        error_message: str = None
    ) -> EmailLog:
        """
        Buat log email baru di database.

        Args:
            db: Database session
            kd_schedule: Cicilan schedule ID
            kd_client: Client ID
            recipient_email: Email tujuan
            subject: Subject email
            email_type: Tipe email (overdue_reminder, payment_confirmation, etc)
            status: Status pengiriman (pending, sent, failed)
            error_message: Pesan error jika gagal

        Returns:
            EmailLog object yang sudah disimpan
        """
        email_log = EmailLog(
            kd_schedule=kd_schedule,
            kd_client=kd_client,
            recipient_email=recipient_email,
            subject=subject,
            email_type=email_type,
            status=status,
            error_message=error_message,
            created_at=datetime.now()
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        return email_log

    @staticmethod
    def update_email_status(
        db: Session,
        kd_email: int,
        status: str,
        error_message: str = None
    ) -> EmailLog:
        """
        Update status email log.

        Args:
            db: Database session
            kd_email: Email log ID
            status: Status baru (sent, failed, etc)
            error_message: Pesan error jika ada

        Returns:
            EmailLog object yang sudah diupdate
        """
        email_log = db.query(EmailLog).filter(EmailLog.kd_email == kd_email).first()
        if email_log:
            email_log.status = status
            if status == 'sent':
                email_log.sent_at = datetime.now()
            if error_message:
                email_log.error_message = error_message
            db.commit()
            db.refresh(email_log)
        return email_log

    @staticmethod
    def get_email_log(db: Session, kd_email: int) -> EmailLog:
        """Get email log by ID."""
        return db.query(EmailLog).filter(EmailLog.kd_email == kd_email).first()

    @staticmethod
    def get_email_logs_by_schedule(
        db: Session,
        kd_schedule: int,
        limit: int = 10
    ) -> list:
        """
        Get email logs untuk satu cicilan schedule.

        Args:
            db: Database session
            kd_schedule: Schedule ID
            limit: Jumlah data yang diambil

        Returns:
            List of EmailLog objects
        """
        return db.query(EmailLog) \
            .filter(EmailLog.kd_schedule == kd_schedule) \
            .order_by(desc(EmailLog.created_at)) \
            .limit(limit) \
            .all()

    @staticmethod
    def get_email_logs_by_client(
        db: Session,
        kd_client: int,
        limit: int = 20
    ) -> list:
        """
        Get email logs untuk satu client.

        Args:
            db: Database session
            kd_client: Client ID
            limit: Jumlah data yang diambil

        Returns:
            List of EmailLog objects
        """
        return db.query(EmailLog) \
            .filter(EmailLog.kd_client == kd_client) \
            .order_by(desc(EmailLog.created_at)) \
            .limit(limit) \
            .all()

    @staticmethod
    def get_failed_emails(
        db: Session,
        days: int = 7
    ) -> list:
        """
        Get email yang gagal dikirim dalam N hari terakhir.

        Args:
            db: Database session
            days: Berapa hari terakhir

        Returns:
            List of EmailLog objects dengan status 'failed'
        """
        since_date = datetime.now() - timedelta(days=days)
        return db.query(EmailLog) \
            .filter(and_(
                EmailLog.status == 'failed',
                EmailLog.created_at >= since_date
            )) \
            .order_by(desc(EmailLog.created_at)) \
            .all()

    @staticmethod
    def get_pending_emails(db: Session, limit: int = 50) -> list:
        """
        Get email yang masih pending (belum dikirim).

        Args:
            db: Database session
            limit: Jumlah data yang diambil

        Returns:
            List of EmailLog objects dengan status 'pending'
        """
        return db.query(EmailLog) \
            .filter(EmailLog.status == 'pending') \
            .order_by(EmailLog.created_at) \
            .limit(limit) \
            .all()

    @staticmethod
    def get_email_statistics(db: Session, days: int = 30) -> dict:
        """
        Get statistik pengiriman email.

        Args:
            db: Database session
            days: Range hari untuk statistik

        Returns:
            {
                'total': total emails,
                'sent': jumlah berhasil,
                'failed': jumlah gagal,
                'pending': jumlah menunggu,
                'success_rate': persentase
            }
        """
        since_date = datetime.now() - timedelta(days=days)

        total = db.query(EmailLog) \
            .filter(EmailLog.created_at >= since_date) \
            .count()

        sent = db.query(EmailLog) \
            .filter(and_(
                EmailLog.status == 'sent',
                EmailLog.created_at >= since_date
            )) \
            .count()

        failed = db.query(EmailLog) \
            .filter(and_(
                EmailLog.status == 'failed',
                EmailLog.created_at >= since_date
            )) \
            .count()

        pending = db.query(EmailLog) \
            .filter(and_(
                EmailLog.status == 'pending',
                EmailLog.created_at >= since_date
            )) \
            .count()

        success_rate = (sent / total * 100) if total > 0 else 0

        return {
            'total': total,
            'sent': sent,
            'failed': failed,
            'pending': pending,
            'success_rate': round(success_rate, 2),
            'period_days': days
        }

    @staticmethod
    def get_email_by_type_statistics(db: Session, days: int = 30) -> dict:
        """
        Get statistik email by tipe.

        Args:
            db: Database session
            days: Range hari untuk statistik

        Returns:
            {
                'overdue_reminder': count,
                'payment_confirmation': count,
                'early_notice': count,
                'final_notice': count,
                ...
            }
        """
        since_date = datetime.now() - timedelta(days=days)

        types = db.query(EmailLog.email_type) \
            .filter(EmailLog.created_at >= since_date) \
            .distinct() \
            .all()

        stats = {}
        for (email_type,) in types:
            if email_type:
                count = db.query(EmailLog) \
                    .filter(and_(
                        EmailLog.email_type == email_type,
                        EmailLog.created_at >= since_date
                    )) \
                    .count()
                stats[email_type] = count

        return stats

    @staticmethod
    def delete_old_emails(db: Session, days: int = 90) -> int:
        """
        Hapus email logs yang lebih tua dari N hari (untuk cleanup).

        Args:
            db: Database session
            days: Hapus email lebih tua dari N hari

        Returns:
            Jumlah record yang dihapus
        """
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted = db.query(EmailLog) \
            .filter(EmailLog.created_at < cutoff_date) \
            .delete()
        db.commit()
        return deleted
