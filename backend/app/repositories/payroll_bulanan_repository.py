from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from decimal import Decimal
from datetime import datetime, date
from app.models import (
    PayrollBulanan, Karyawan, Gaji, Bonus, LemburHistori, 
    AbsensiHistori, KonfigurasiAbsensi
)
from app.repositories.base_repository import BaseRepository


class PayrollBulananRepository(BaseRepository):
    def __init__(self, db: Session = None):
        if db is None:
            from app.database.connection import SessionLocal
            db = SessionLocal()
        super().__init__(PayrollBulanan, db)
    
    def get_payroll_by_karyawan_periode(self, db: Session, kd_karyawan: int, periode: date):
        """Get payroll record for specific karyawan and periode"""
        return db.query(PayrollBulanan).filter(
            and_(
                PayrollBulanan.kd_karyawan == kd_karyawan,
                PayrollBulanan.periode == periode
            )
        ).first()
    
    def get_payroll_by_periode(self, db: Session, periode: date):
        """Get all payroll records for a specific periode"""
        return db.query(PayrollBulanan).filter(
            PayrollBulanan.periode == periode
        ).all()
    
    def generate_monthly_payroll(self, db: Session, periode: date):
        """
        Generate monthly payroll for all karyawan
        
        Catatan: periode diambil dari AKHIR bulan (tanggal 30/31) untuk memastikan
        semua data transaksi, lembur, absen, dll untuk bulan tersebut sudah lengkap.
        
        Args:
            db: Database session
            periode: Date object, ideally last day of month (e.g., 2024-12-31 or 2024-12-30)
        
        Returns:
            dict with keys: success (int), skipped (int), error (int), payrolls (list), errors (list)
        """
        stats = {
            "success": 0,
            "skipped": 0,
            "error": 0,
            "payrolls": [],
            "errors": []
        }
        
        try:
            # Normalize periode ke akhir bulan jika bukan akhir bulan
            # Cek apakah ada hari berikutnya di bulan yang sama
            from calendar import monthrange
            last_day = monthrange(periode.year, periode.month)[1]
            periode_normalized = date(periode.year, periode.month, last_day)
            
            # Check if payroll already exists for this periode
            existing_count = db.query(PayrollBulanan).filter(
                PayrollBulanan.periode == periode_normalized
            ).count()
            
            if existing_count > 0:
                stats["skipped"] = existing_count
                return stats
            
            # Get all karyawan
            karyawans = db.query(Karyawan).all()
            
            for karyawan in karyawans:
                try:
                    # Calculate gaji pokok (simplified)
                    gaji_pokok = Decimal(0)
                    if karyawan.jumlah_gaji:
                        gaji_pokok = Decimal(str(karyawan.jumlah_gaji))
                    elif karyawan.kd_gaji:
                        gaji_record = db.query(Gaji).filter(
                            Gaji.kd_gaji == karyawan.kd_gaji
                        ).first()
                        if gaji_record and gaji_record.jumlah_gaji:
                            gaji_pokok = Decimal(str(gaji_record.jumlah_gaji))
                    
                    # For now, just use basic salary
                    total_penerimaan = gaji_pokok
                    total_potongan = Decimal(0)
                    total_gaji = total_penerimaan - total_potongan
                    
                    # Create payroll record with normalized periode (akhir bulan)
                    payroll = PayrollBulanan(
                        kd_karyawan=karyawan.kd_karyawan,
                        periode=periode_normalized,
                        gaji_pokok=gaji_pokok,
                        bonus=Decimal(0),
                        lembur=Decimal(0),
                        tunjangan_lainnya=Decimal(0),
                        potongan_absen=Decimal(0),
                        potongan_pajak=Decimal(0),
                        potongan_asuransi=Decimal(0),
                        potongan_lainnya=Decimal(0),
                        jumlah_absen=0,
                        jumlah_jam_lembur=Decimal(0),
                        total_penerimaan=total_penerimaan,
                        total_potongan=total_potongan,
                        total_gaji=total_gaji,
                        status='draft'
                    )
                    
                    db.add(payroll)
                    db.flush()
                    stats["payrolls"].append(payroll)
                    stats["success"] += 1
                    
                except Exception as e:
                    stats["errors"].append(f"Error processing {karyawan.nama_karyawan}: {str(e)}")
                    stats["error"] += 1
            
            db.commit()
            return stats
            
        except Exception as e:
            db.rollback()
            stats["errors"].append(f"Transaction error: {str(e)}")
            stats["error"] += 1
            return stats
    
    def update_payroll_status(self, db: Session, kd_payroll_bulanan: int, status: str):
        """Update payroll status (draft -> approved -> paid)"""
        payroll = self.get_by_id(db, kd_payroll_bulanan)
        if payroll:
            payroll.status = status
            payroll.updated_at = datetime.utcnow()
            db.commit()
            return payroll
        return None
