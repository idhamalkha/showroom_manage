from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from ..models import AbsensiHistori, KonfigurasiAbsensi, Karyawan
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger(__name__)

class AbsensiHistoriRepository:
    @staticmethod
    def get_attendance_for_month(session: Session, kd_karyawan: int, year: int, month: int):
        """Get all attendance records for an employee in a specific month"""
        try:
            records = session.query(AbsensiHistori).filter(
                and_(
                    AbsensiHistori.kd_karyawan == kd_karyawan,
                    func.extract('year', AbsensiHistori.tgl_absensi) == year,
                    func.extract('month', AbsensiHistori.tgl_absensi) == month
                )
            ).all()
            return records
        except Exception as e:
            logger.error(f"Error getting attendance for month: {str(e)}")
            return []

    @staticmethod
    def count_absent_days(session: Session, kd_karyawan: int, year: int, month: int) -> int:
        """Count the number of absent days for an employee in a specific month"""
        try:
            count = session.query(func.count(AbsensiHistori.kd_absensi)).filter(
                and_(
                    AbsensiHistori.kd_karyawan == kd_karyawan,
                    AbsensiHistori.status == 'absen',
                    func.extract('year', AbsensiHistori.tgl_absensi) == year,
                    func.extract('month', AbsensiHistori.tgl_absensi) == month
                )
            ).scalar() or 0
            return int(count)
        except Exception as e:
            logger.error(f"Error counting absent days: {str(e)}")
            return 0

    @staticmethod
    def count_present_days(session: Session, kd_karyawan: int, year: int, month: int) -> int:
        """Count the number of present days for an employee in a specific month"""
        try:
            count = session.query(func.count(AbsensiHistori.kd_absensi)).filter(
                and_(
                    AbsensiHistori.kd_karyawan == kd_karyawan,
                    AbsensiHistori.status == 'hadir',
                    func.extract('year', AbsensiHistori.tgl_absensi) == year,
                    func.extract('month', AbsensiHistori.tgl_absensi) == month
                )
            ).scalar() or 0
            return int(count)
        except Exception as e:
            logger.error(f"Error counting present days: {str(e)}")
            return 0

    @staticmethod
    def calculate_absence_deduction(session: Session, jumlah_absen: int, gaji_pokok: float) -> float:
        """Calculate salary deduction based on number of absences"""
        try:
            config = session.query(KonfigurasiAbsensi).filter(
                and_(
                    KonfigurasiAbsensi.jenis_absensi == 'absen',
                    KonfigurasiAbsensi.is_active == True
                )
            ).first()
            
            if not config:
                return 0.0
            
            # If percentage is set, use it; otherwise use nominal
            if config.potongan_persen > 0:
                deduction_per_day = (gaji_pokok * config.potongan_persen) / 100
                total_deduction = deduction_per_day * jumlah_absen
            else:
                total_deduction = config.potongan_nominal * jumlah_absen
            
            return float(total_deduction)
        except Exception as e:
            logger.error(f"Error calculating absence deduction: {str(e)}")
            return 0.0

    @staticmethod
    def get_or_create(session: Session, kd_karyawan: int, tgl_absensi, status: str = 'hadir', keterangan: str = None):
        """Get or create attendance record for a specific date"""
        try:
            record = session.query(AbsensiHistori).filter(
                and_(
                    AbsensiHistori.kd_karyawan == kd_karyawan,
                    AbsensiHistori.tgl_absensi == tgl_absensi
                )
            ).first()
            
            if not record:
                record = AbsensiHistori(
                    kd_karyawan=kd_karyawan,
                    tgl_absensi=tgl_absensi,
                    status=status,
                    keterangan=keterangan
                )
                session.add(record)
                session.commit()
            else:
                # Update existing record with new status and keterangan
                record.status = status
                record.keterangan = keterangan
                session.commit()
            
            return record
        except Exception as e:
            logger.error(f"Error in get_or_create: {str(e)}")
            session.rollback()
            return None

    @staticmethod
    def auto_mark_absent_after_8am(session: Session) -> dict:
        """
        Auto-mark employees as 'absen' if they haven't recorded attendance by 8am.
        This should be run daily after 8am (e.g., 8:30am or 9am)
        Returns dict with count of auto-marked absences
        """
        try:
            today = date.today()
            current_time = datetime.now().time()
            
            # Only run if it's past 8am
            from datetime import time
            cutoff_time = time(8, 0, 0)  # 8:00 AM
            
            if current_time < cutoff_time:
                logger.info("It's not past 8am yet, skipping auto-absent marking")
                return {"status": "skipped", "reason": "Before 8am", "count": 0}
            
            # Get all employees who should be working today
            # Assuming working days are Mon-Fri (weekday 0-4)
            if today.weekday() >= 5:  # Saturday=5, Sunday=6
                logger.info(f"{today} is a weekend, skipping auto-absent marking")
                return {"status": "skipped", "reason": "Weekend", "count": 0}
            
            all_employees = session.query(Karyawan).all()
            auto_marked_count = 0
            
            for employee in all_employees:
                # Check if employee already has attendance record for today
                existing_record = session.query(AbsensiHistori).filter(
                    and_(
                        AbsensiHistori.kd_karyawan == employee.kd_karyawan,
                        AbsensiHistori.tgl_absensi == today
                    )
                ).first()
                
                if not existing_record:
                    # Auto-mark as absent
                    absent_record = AbsensiHistori(
                        kd_karyawan=employee.kd_karyawan,
                        tgl_absensi=today,
                        status='absen',
                        keterangan='Auto-marked absent (tidak hadir sebelum jam 08:00)'
                    )
                    session.add(absent_record)
                    auto_marked_count += 1
                    logger.info(f"Auto-marked {employee.nama_karyawan} (kd={employee.kd_karyawan}) as absent")
            
            session.commit()
            
            return {
                "status": "success",
                "message": f"Auto-marked {auto_marked_count} employees as absent",
                "count": auto_marked_count,
                "date": str(today)
            }
            
        except Exception as e:
            logger.error(f"Error in auto_mark_absent_after_8am: {str(e)}")
            session.rollback()
            return {
                "status": "error",
                "message": str(e),
                "count": 0
            }
