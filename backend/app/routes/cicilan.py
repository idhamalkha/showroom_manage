import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.utils.security import get_current_user
from app.repositories.cicilan_repository import CicilanRepository
from app.repositories.customer_credit_repository import CustomerCreditRepository
from app.repositories.email_repository import EmailRepository
from app.models import CicilanSchedule, Client
from app.utils.email_service import email_service
from app.templates.email_templates import get_email_template
from pydantic import BaseModel
from datetime import date, datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/finance/cicilan", tags=["finance-cicilan"])


class NoteCreate(BaseModel):
    note: str


class EmailPayload(BaseModel):
    """Request body untuk mengirim email ke customer"""
    email_type: str  # overdue_reminder, payment_confirmation, early_notice, final_notice
    to_email: str = None  # Optional, default ke client email
    custom_message: str = None  # Optional custom message


@router.post("/schedule/generate")
async def generate_cicilan_schedule(
    kd_cicilan: int,
    jumlah_cicilan: float,
    tenor: int,
    tgl_mulai: str,  # Format: YYYY-MM-DD
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate jadwal cicilan otomatis.
    Akan membuat schedule untuk setiap bulan sesuai tenor.
    """
    try:
        repo = CicilanRepository(db)
        schedules = repo.generate_cicilan_schedule(kd_cicilan, jumlah_cicilan, tenor, tgl_mulai)
        return {
            "success": True,
            "message": f"Generated {tenor} cicilan schedules",
            "schedules": schedules
        }
    except Exception as e:
        logger.error(f"Error generating cicilan schedule: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/schedule/{kd_cicilan}")
async def get_cicilan_schedules(
    kd_cicilan: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get semua schedules untuk satu cicilan"""
    try:
        repo = CicilanRepository(db)
        schedules = repo.get_cicilan_schedules(kd_cicilan)
        return {
            "success": True,
            "kd_cicilan": kd_cicilan,
            "schedules": schedules
        }
    except Exception as e:
        logger.error(f"Error getting cicilan schedules: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/overdue")
async def get_overdue_cicilan(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get semua cicilan yang overdue (belum dibayar & lewat jatuh tempo).
    Untuk finance staff untuk follow-up.
    """
    try:
        repo = CicilanRepository(db)
        overdue = repo.get_overdue_cicilan(limit)
        return {
            "success": True,
            "total_overdue": len(overdue),
            "data": overdue
        }
    except Exception as e:
        logger.error(f"Error getting overdue cicilan: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/active")
async def get_active_cicilan(
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get semua cicilan yang masih aktif (ada schedule pending).
    Untuk finance staff dashboard overview.
    """
    try:
        repo = CicilanRepository(db)
        active = repo.get_active_cicilan(limit)
        return {
            "success": True,
            "total_active": len(active),
            "data": active
        }
    except Exception as e:
        logger.error(f"Error getting active cicilan: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/schedule/{kd_schedule}/mark-paid")
async def mark_cicilan_paid(
    kd_schedule: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark cicilan schedule sebagai paid - simple version tanpa perlu kd_payment"""
    try:
        repo = CicilanRepository(db)
        
        # Get schedule dari DB
        schedule = db.query(CicilanSchedule).filter(CicilanSchedule.kd_schedule == kd_schedule).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Cicilan schedule tidak ditemukan")
        
        # Update status menjadi paid
        schedule.status = "paid"
        schedule.tgl_pembayaran = date.today()
        db.commit()
        
        # Update payment history
        if schedule.cicilan and schedule.cicilan.transaksi:
            credit_repo = CustomerCreditRepository(db)
            kd_client = schedule.cicilan.transaksi.kd_client
            credit_repo.update_payment_history(kd_client)
        
        return {
            "success": True,
            "message": f"Cicilan schedule {kd_schedule} marked as paid"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking cicilan paid: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/schedule/{kd_schedule}/note")
async def add_cicilan_note(
    kd_schedule: int,
    payload: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tambah note/catatan untuk cicilan schedule"""
    try:
        # Get schedule dari DB
        schedule = db.query(CicilanSchedule).filter(CicilanSchedule.kd_schedule == kd_schedule).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Cicilan schedule tidak ditemukan")
        
        # Add note - append ke note existing jika ada
        timestamp = date.today().isoformat()
        new_note = f"[{timestamp}] {payload.note}"
        
        if schedule.catatan:
            schedule.catatan = schedule.catatan + "\n" + new_note
        else:
            schedule.catatan = new_note
        
        db.commit()
        
        return {
            "success": True,
            "message": "Catatan berhasil ditambahkan",
            "catatan": schedule.catatan
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding note: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/summary/{kd_client}")
async def get_cicilan_summary(
    kd_client: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary cicilan untuk satu client"""
    try:
        repo = CicilanRepository(db)
        summary = repo.get_cicilan_summary_by_client(kd_client)
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error getting cicilan summary: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/schedule/{kd_schedule}/send-email")
async def send_cicilan_email(
    kd_schedule: int,
    payload: EmailPayload,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kirim email reminder/notifikasi ke customer untuk cicilan tertentu.
    
    Email types:
    - overdue_reminder: Reminder pembayaran yang sudah terlambat
    - payment_confirmation: Konfirmasi pembayaran diterima
    - early_notice: Notifikasi pembayaran akan jatuh tempo
    - final_notice: Pemberitahuan akhir sebelum eskalasi
    """
    try:
        # Get schedule dari DB
        schedule = db.query(CicilanSchedule).filter(
            CicilanSchedule.kd_schedule == kd_schedule
        ).first()
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Cicilan schedule tidak ditemukan")
        
        # Get client data
        client = db.query(Client).filter(
            Client.kd_client == schedule.kd_client
        ).first()
        
        if not client:
            raise HTTPException(status_code=404, detail="Client tidak ditemukan")
        
        # Determine recipient email
        to_email = payload.to_email or client.username_client
        if not to_email:
            raise HTTPException(
                status_code=400, 
                detail="Email tujuan tidak ditemukan. Set di payload atau client profile."
            )
        
        # Get email template based on type
        try:
            if payload.email_type == 'overdue_reminder':
                days_overdue = (date.today() - schedule.tgl_jatuh_tempo).days
                subject, body = get_email_template(
                    'overdue_reminder',
                    customer_name=client.nama_client,
                    kd_schedule=kd_schedule,
                    amount=schedule.jumlah_cicilan,
                    due_date=schedule.tgl_jatuh_tempo.isoformat() if schedule.tgl_jatuh_tempo else "N/A",
                    days_overdue=max(0, days_overdue),
                    admin_phone="62-123-456-7890",
                    admin_email="finance@showroom.com"
                )
            
            elif payload.email_type == 'payment_confirmation':
                remaining = 0
                if schedule.cicilan and hasattr(schedule.cicilan, 'jumlah_cicilan'):
                    remaining = schedule.cicilan.jumlah_cicilan - schedule.jumlah_cicilan
                
                subject, body = get_email_template(
                    'payment_confirmation',
                    customer_name=client.nama_client,
                    kd_schedule=kd_schedule,
                    amount=schedule.jumlah_cicilan,
                    payment_date=date.today().isoformat(),
                    remaining_balance=remaining if remaining > 0 else None
                )
            
            elif payload.email_type == 'early_notice':
                days_until = (schedule.tgl_jatuh_tempo - date.today()).days if schedule.tgl_jatuh_tempo else 0
                subject, body = get_email_template(
                    'early_notice',
                    customer_name=client.nama_client,
                    kd_schedule=kd_schedule,
                    amount=schedule.jumlah_cicilan,
                    due_date=schedule.tgl_jatuh_tempo.isoformat() if schedule.tgl_jatuh_tempo else "N/A",
                    days_until_due=max(0, days_until)
                )
            
            elif payload.email_type == 'final_notice':
                days_overdue = (date.today() - schedule.tgl_jatuh_tempo).days if schedule.tgl_jatuh_tempo else 0
                subject, body = get_email_template(
                    'final_notice',
                    customer_name=client.nama_client,
                    kd_schedule=kd_schedule,
                    amount=schedule.jumlah_cicilan,
                    days_overdue=max(0, days_overdue),
                    escalation_action="pengambilan kendaraan"
                )
            
            else:
                raise ValueError(f"Unknown email type: {payload.email_type}")
        
        except Exception as e:
            logger.error(f"Error generating email template: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error generating email: {str(e)}")
        
        # Log email ke database (create pending record)
        email_log = EmailRepository.create_email_log(
            db=db,
            kd_schedule=kd_schedule,
            kd_client=schedule.kd_client,
            recipient_email=to_email,
            subject=subject,
            email_type=payload.email_type,
            status='pending'
        )
        
        # Send email via SMTP
        result = email_service.send_email(
            to_email=to_email,
            subject=subject,
            body=body,
            is_html=True
        )
        
        # Update email log status
        if result['success']:
            EmailRepository.update_email_status(
                db=db,
                kd_email=email_log.kd_email,
                status='sent'
            )
            logger.info(f"✅ Email sent to {to_email} | Type: {payload.email_type}")
            
            return {
                "success": True,
                "message": f"Email berhasil dikirim ke {to_email}",
                "email_log_id": email_log.kd_email,
                "email_type": payload.email_type,
                "sent_at": result.get('sent_at')
            }
        else:
            EmailRepository.update_email_status(
                db=db,
                kd_email=email_log.kd_email,
                status='failed',
                error_message=result.get('error', 'Unknown error')
            )
            logger.error(f"❌ Failed to send email to {to_email}: {result.get('error')}")
            
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send email: {result.get('message')}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in send_cicilan_email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
