"""
Background tasks untuk scheduler
- Auto-absent marking after 8am
- Payroll bulanan processing
"""
import asyncio
import logging
from datetime import datetime, time, timedelta
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


async def auto_absent_scheduler():
    """
    Background task yang berjalan setiap detik untuk check apakah sudah past 8am.
    Jika sudah, jalankan auto-absent marking sekali per hari.
    """
    from app.repositories.absensi_histori_repository import AbsensiHistoriRepository
    from app.database.connection import SessionLocal
    
    last_run_date = None
    
    while True:
        try:
            current_time = datetime.now().time()
            current_date = datetime.now().date()
            cutoff_time = time(8, 0, 0)  # 8:00 AM
            
            # Run only after 8am dan belum pernah dijalankan hari ini
            if current_time >= cutoff_time and last_run_date != current_date:
                # Check if it's not a weekend
                if current_date.weekday() < 5:  # Monday=0 to Friday=4
                    logger.info(f"Running auto-absent scheduler at {current_time} for {current_date}")
                    
                    db = SessionLocal()
                    try:
                        result = AbsensiHistoriRepository.auto_mark_absent_after_8am(db)
                        logger.info(f"Auto-absent result: {result}")
                    except Exception as e:
                        logger.error(f"Error in auto-absent scheduler: {str(e)}")
                    finally:
                        db.close()
                    
                    last_run_date = current_date
                else:
                    logger.info(f"{current_date} is a weekend, skipping auto-absent")
                    last_run_date = current_date
            
            # Sleep for 60 seconds before checking again
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.error(f"Error in auto_absent_scheduler: {str(e)}")
            await asyncio.sleep(60)


async def payroll_bulanan_scheduler():
    """
    Background task untuk proses payroll bulanan.
    Berjalan di akhir bulan atau sesuai jadwal yang ditentukan.
    
    TODO: Implementasi payroll bulanan processing
    """
    from app.database.connection import SessionLocal
    
    last_run_date = None
    
    while True:
        try:
            current_date = datetime.now().date()
            
            # Check if it's the last day of the month and hasn't run yet
            # Atau bisa diatur ke tanggal tertentu (misal: hari ke-25 setiap bulan)
            from datetime import timedelta
            tomorrow = current_date + timedelta(days=1)
            is_last_day_of_month = tomorrow.day == 1
            
            if is_last_day_of_month and last_run_date != current_date:
                logger.info(f"Running payroll bulanan scheduler for {current_date}")
                
                db = SessionLocal()
                try:
                    # TODO: Panggil method untuk generate payroll bulanan
                    # Implementasi akan ditambahkan nanti
                    logger.info("Payroll bulanan processing - placeholder (not yet implemented)")
                except Exception as e:
                    logger.error(f"Error in payroll bulanan scheduler: {str(e)}")
                finally:
                    db.close()
                
                last_run_date = current_date
            
            # Sleep for 1 hour before checking again
            await asyncio.sleep(3600)
            
        except Exception as e:
            logger.error(f"Error in payroll_bulanan_scheduler: {str(e)}")
            await asyncio.sleep(3600)
