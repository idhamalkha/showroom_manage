from sqlalchemy.orm import Session
from app.models.payroll import Payroll
from app.models.karyawan import Karyawan
from app.models.gaji import Gaji
from app.models.bonus import Bonus
from app.models.lembur_histori import LemburHistori
from app.models.absensi_histori import AbsensiHistori
from app.models.konfigurasi_absensi import KonfigurasiAbsensi
from typing import List, Optional
from datetime import date, datetime
import logging

logger = logging.getLogger(__name__)

def get_all(db: Session) -> List[Payroll]:
    return db.query(Payroll).all()

def get_by_id(db: Session, kd_payroll: int) -> Optional[Payroll]:
    return db.query(Payroll).filter(Payroll.kd_payroll == kd_payroll).first()

def get_by_karyawan_periode(db: Session, kd_karyawan: int, periode: date) -> Optional[Payroll]:
    """Get payroll for specific karyawan and periode"""
    return db.query(Payroll).filter(
        Payroll.kd_karyawan == kd_karyawan,
        Payroll.periode == periode
    ).first()

def create(db: Session, obj_in: dict) -> Payroll:
    obj = Payroll(**obj_in)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def update(db: Session, kd_payroll: int, changes: dict) -> Optional[Payroll]:
    obj = get_by_id(db, kd_payroll)
    if not obj:
        return None
    for k, v in changes.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def delete(db: Session, kd_payroll: int) -> bool:
    obj = get_by_id(db, kd_payroll)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True

def generate_monthly_payroll(db: Session, periode: date) -> dict:
    """
    Generate payroll for all active karyawan untuk periode tertentu (biasanya awal bulan)
    
    Args:
        db: Database session
        periode: Tanggal periode (biasanya tanggal 1 bulan)
    
    Returns:
        dict dengan statistik: {
            'success': int,
            'skipped': int,
            'error': int,
            'payrolls': [list of created payroll kd],
            'errors': [list of error messages]
        }
    """
    try:
        stats = {
            'success': 0,
            'skipped': 0,
            'error': 0,
            'payrolls': [],
            'errors': []
        }
        
        # Normalize periode to first day of month
        periode_normalized = date(periode.year, periode.month, 1)
        
        # Check if payroll already exists for this periode
        existing = db.query(Payroll).filter(
            Payroll.periode == periode_normalized
        ).count()
        
        if existing > 0:
            stats['skipped'] = existing
            stats['errors'].append(f"Payroll untuk periode {periode_normalized.strftime('%Y-%m')} sudah ada ({existing} records)")
            return stats
        
        # Get all active karyawan
        karyawans = db.query(Karyawan).all()  # Get semua karyawan
        
        logger.info(f"Generating payroll for {len(karyawans)} karyawan for periode {periode_normalized}")
        
        for karyawan in karyawans:
            try:
                # Get base salary dari Karyawan.jumlah_gaji atau dari Gaji record jika ada
                gaji_pokok = float(karyawan.jumlah_gaji or 0) if karyawan.jumlah_gaji else 0.0
                
                # Fallback: jika Karyawan.jumlah_gaji kosong, coba ambil dari Gaji table
                if gaji_pokok == 0 and karyawan.kd_gaji:
                    gaji_record = db.query(Gaji).filter(Gaji.kd_gaji == karyawan.kd_gaji).first()
                    if gaji_record:
                        gaji_pokok = float(gaji_record.jumlah_gaji or 0)
                
                # Get bonus for this periode (bulan)
                bonus_records = db.query(Bonus).filter(
                    Bonus.kd_karyawan == karyawan.kd_karyawan,
                    Bonus.periode >= periode_normalized,
                    Bonus.periode < date(
                        periode_normalized.year if periode_normalized.month < 12 else periode_normalized.year + 1,
                        periode_normalized.month + 1 if periode_normalized.month < 12 else 1,
                        1
                    )
                ).all()
                
                bonus = sum(float(br.jumlah_bonus or 0) for br in bonus_records) if bonus_records else 0.0
                
                # Calculate overtime (lembur) for this periode
                lembur_records = db.query(LemburHistori).filter(
                    LemburHistori.kd_karyawan == karyawan.kd_karyawan,
                    LemburHistori.tanggal >= periode_normalized,
                    LemburHistori.tanggal < date(
                        periode_normalized.year if periode_normalized.month < 12 else periode_normalized.year + 1,
                        periode_normalized.month + 1 if periode_normalized.month < 12 else 1,
                        1
                    )
                ).all()
                
                total_jam_lembur = sum(float(lr.jumlah_jam or 0) for lr in lembur_records)
                tarif_lembur = 50000.0  # Tarif lembur per jam (bisa dikonfigurasi)
                lembur = total_jam_lembur * tarif_lembur
                
                # Calculate absensi deduction
                konfigurasi_absensi = db.query(KonfigurasiAbsensi).first()
                potongan_per_hari = float(konfigurasi_absensi.potongan_per_hari) if konfigurasi_absensi else gaji_pokok / 25  # Default 1/25 dari gaji
                
                absensi_records = db.query(AbsensiHistori).filter(
                    AbsensiHistori.kd_karyawan == karyawan.kd_karyawan,
                    AbsensiHistori.tanggal >= periode_normalized,
                    AbsensiHistori.tanggal < date(
                        periode_normalized.year if periode_normalized.month < 12 else periode_normalized.year + 1,
                        periode_normalized.month + 1 if periode_normalized.month < 12 else 1,
                        1
                    ),
                    AbsensiHistori.status == 'Absent'
                ).count()
                
                jumlah_absen = absensi_records
                potongan_absen = jumlah_absen * potongan_per_hari
                
                # Calculate total gaji
                total_gaji = gaji_pokok + bonus + lembur - potongan_absen
                total_gaji = max(0, total_gaji)  # Ensure tidak minus
                
                # Create payroll record
                payroll = Payroll(
                    kd_karyawan=karyawan.kd_karyawan,
                    gaji_pokok=gaji_pokok,
                    bonus=bonus,
                    lembur=lembur,
                    potongan=potongan_absen,
                    jumlah_absen=jumlah_absen,
                    potongan_absen=potongan_absen,
                    total_gaji=total_gaji,
                    periode=periode_normalized,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                db.add(payroll)
                db.flush()
                
                stats['success'] += 1
                stats['payrolls'].append(payroll.kd_payroll)
                
                logger.info(f"Created payroll for {karyawan.nama_karyawan}: Rp {total_gaji}")
                
            except Exception as e:
                stats['error'] += 1
                error_msg = f"Error creating payroll for {karyawan.nama_karyawan}: {str(e)}"
                stats['errors'].append(error_msg)
                logger.error(error_msg)
                db.rollback()
        
        # Commit all changes
        db.commit()
        logger.info(f"Payroll generation completed: {stats['success']} success, {stats['error']} errors, {stats['skipped']} skipped")
        
        return stats
        
    except Exception as e:
        logger.error(f"Unexpected error in generate_monthly_payroll: {str(e)}")
        db.rollback()
        return {
            'success': 0,
            'skipped': 0,
            'error': 1,
            'payrolls': [],
            'errors': [f"Unexpected error: {str(e)}"]
        }
