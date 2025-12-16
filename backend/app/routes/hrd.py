from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, Integer
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from app.database.connection import get_db
from app.repositories.hrd_repository import HRDRepository
from app.models.karyawan import Karyawan
from app.models.cuti_histori import CutiHistori
from app.models.lembur_histori import LemburHistori
from app.utils.permissions import require_role
from app.repositories.notifikasi_repository import NotifikasiRepository
from app.routes.auth import get_current_user

router = APIRouter(prefix="/hrd", tags=["HRD"])

# Pydantic schemas for cuti approval
class ApprovalRequest(BaseModel):
    approval_notes: str = ""
    
class CutiResponse(BaseModel):
    kd_cuti: int
    kd_karyawan: int
    nama_karyawan: str
    tgl_mulai: str
    tgl_selesai: str
    durasi_hari: int
    alasan: str
    status: str
    approved_by: int = None
    approval_date: datetime = None
    created_at: datetime

    class Config:
        from_attributes = True

def _user_name(user):
    return getattr(user, "nama_karyawan", getattr(user, "username_owner", None) or getattr(user, "username_client", None))

@router.get("/karyawan")
def get_all_karyawan(db: Session = Depends(get_db), current_user = require_role(["HRD", "Owner"])):
    repo = HRDRepository(db)
    return repo.get_all_karyawan()

@router.get("/karyawan/divisi/{kd_jabatan}")
def get_karyawan_by_divisi(kd_jabatan: int, db: Session = Depends(get_db), current_user = require_role(["HRD", "Owner"])):
    repo = HRDRepository(db)
    return repo.get_karyawan_by_divisi(kd_jabatan)

@router.get("/karyawan/{kd_karyawan}")
def get_karyawan_detail(kd_karyawan: int, db: Session = Depends(get_db), current_user = require_role(["HRD", "Owner"])):
    # HRD/Owner can view details; if current_user is HRD but requests own data it's allowed
    repo = HRDRepository(db)
    user = repo.get_karyawan_detail(kd_karyawan)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karyawan tidak ditemukan")
    return user

@router.post("/karyawan")
def create_karyawan(karyawan: dict, db: Session = Depends(get_db), current_user = require_role(["HRD", "Owner"])):
    repo = HRDRepository(db)

    # if client provided credentials explicitly, create and return same shaped response
    if karyawan.get("username_karyawan") and karyawan.get("hashed_password"):
        karyawan_obj = Karyawan(**karyawan)
        created = repo.create_karyawan(karyawan_obj)
        try:
            actor = _user_name(current_user)
            print(f"[AUDIT] Karyawan dibuat oleh {actor}: kd_karyawan={created.kd_karyawan}")
        except Exception:
            pass
        return {"karyawan": created, "generated": None}

    # otherwise let repository generate username/password from nama_karyawan + tgl_lahir
    result = repo.create_karyawan_with_credentials(karyawan)
    try:
        actor = _user_name(current_user)
        print(f"[AUDIT] Karyawan dibuat oleh {actor}: kd_karyawan={result['karyawan'].kd_karyawan} (username generated)")
    except Exception:
        pass
    # result is already {"karyawan":Karyawan, "generated":{username,password}}
    return result

@router.put("/karyawan/{kd_karyawan}")
def update_karyawan(kd_karyawan: int, data: dict, db: Session = Depends(get_db)):
    repo = HRDRepository(db)
    updated = repo.update_karyawan(kd_karyawan, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karyawan tidak ditemukan")
    return updated

@router.delete("/karyawan/{kd_karyawan}")
def delete_karyawan(kd_karyawan: int, db: Session = Depends(get_db), current_user = require_role(["HRD", "Owner"])):
    repo = HRDRepository(db)
    repo.delete_karyawan(kd_karyawan)
    try:
        actor = _user_name(current_user)
        print(f"[AUDIT] Karyawan dihapus oleh {actor}: kd_karyawan={kd_karyawan}")
    except Exception:
        pass
    return {"message": "Karyawan dihapus"}

@router.get("/kinerja")
def get_kpi_grid(db: Session = Depends(get_db)):
    repo = HRDRepository(db)
    return repo.get_kpi_grid()

@router.get("/top-sales")
def get_top_sales(periode: str, db: Session = Depends(get_db), current_user = require_role(["HRD", "Owner"])):
    repo = HRDRepository(db)
    return repo.get_top_sales(periode)


# ===== CUTI APPROVAL ENDPOINTS =====

@router.get("/cuti/pending")
def get_pending_cuti(db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    """Get all pending cuti requests (excluding expired ones)"""
    # Verify user is HRD or Owner
    if not current_user.jabatan or current_user.jabatan.nama_jabatan not in ["HRD", "Owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        # Use explicit join to avoid ambiguity (two FK: kd_karyawan, approved_by)
        # Filter: status pending AND tgl_mulai >= today (not expired)
        pending_cuti = db.query(CutiHistori).join(
            Karyawan, CutiHistori.kd_karyawan == Karyawan.kd_karyawan
        ).filter(
            CutiHistori.status == 'pending',
            CutiHistori.tgl_mulai >= func.current_date()
        ).all()
        
        result = []
        for c in pending_cuti:
            result.append({
                "kd_cuti": c.kd_cuti,
                "kd_karyawan": c.kd_karyawan,
                "nama_karyawan": c.karyawan.nama_karyawan,
                "jabatan": getattr(c.karyawan.jabatan, "nama_jabatan", "") if c.karyawan.jabatan else "",
                "tgl_mulai": c.tgl_mulai.isoformat() if c.tgl_mulai else None,
                "tgl_selesai": c.tgl_selesai.isoformat() if c.tgl_selesai else None,
                "durasi_hari": c.durasi_hari,
                "alasan": c.alasan,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cuti/approve/{kd_cuti}")
def approve_cuti(kd_cuti: int, payload: ApprovalRequest, db: Session = Depends(get_db), 
                 current_user: Karyawan = Depends(get_current_user)):
    """Approve a pending cuti request"""
    # Verify user is HRD or Owner
    if not current_user.jabatan or current_user.jabatan.nama_jabatan not in ["HRD", "Owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        cuti = db.query(CutiHistori).filter(CutiHistori.kd_cuti == kd_cuti).first()
        if not cuti:
            raise HTTPException(status_code=404, detail="Cuti tidak ditemukan")
        
        if cuti.status != 'pending':
            raise HTTPException(status_code=400, detail=f"Cuti sudah di-{cuti.status}")
        
        # Update cuti status
        cuti.status = 'approved'
        cuti.approved_by = current_user.kd_karyawan
        cuti.approval_date = datetime.utcnow()
        db.add(cuti)
        db.commit()
        
        # Create notification for employee
        try:
            notif_repo = NotifikasiRepository(db)
            notes_text = f" Catatan: {payload.approval_notes}" if payload.approval_notes else ""
            notif_repo.create_notifikasi(
                kd_karyawan=cuti.kd_karyawan,
                judul="Cuti Disetujui",
                pesan=f"Permohonan cuti Anda dari {cuti.tgl_mulai} sampai {cuti.tgl_selesai} telah disetujui oleh HRD.{notes_text}",
                tipe_notifikasi="cuti_approved",
                referensi_id=cuti.kd_cuti,
                referensi_tipe="cuti"
            )
        except Exception as notif_err:
            print(f"Error creating notification: {notif_err}")
        
        return {
            "success": True,
            "message": "Cuti disetujui",
            "data": {
                "kd_cuti": cuti.kd_cuti,
                "status": cuti.status,
                "approved_by": cuti.approved_by,
                "approval_date": cuti.approval_date.isoformat() if cuti.approval_date else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cuti/reject/{kd_cuti}")
def reject_cuti(kd_cuti: int, payload: ApprovalRequest, db: Session = Depends(get_db), 
                current_user: Karyawan = Depends(get_current_user)):
    """Reject a pending cuti request"""
    # Verify user is HRD or Owner
    if not current_user.jabatan or current_user.jabatan.nama_jabatan not in ["HRD", "Owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        cuti = db.query(CutiHistori).filter(CutiHistori.kd_cuti == kd_cuti).first()
        if not cuti:
            raise HTTPException(status_code=404, detail="Cuti tidak ditemukan")
        
        if cuti.status != 'pending':
            raise HTTPException(status_code=400, detail=f"Cuti sudah di-{cuti.status}")
        
        # Update cuti status
        cuti.status = 'rejected'
        cuti.approved_by = current_user.kd_karyawan
        cuti.approval_date = datetime.utcnow()
        db.add(cuti)
        db.commit()
        
        # Create notification for employee
        try:
            notif_repo = NotifikasiRepository(db)
            notes_text = f" Alasan: {payload.approval_notes}" if payload.approval_notes else ""
            notif_repo.create_notifikasi(
                kd_karyawan=cuti.kd_karyawan,
                judul="Cuti Ditolak",
                pesan=f"Permohonan cuti Anda dari {cuti.tgl_mulai} sampai {cuti.tgl_selesai} telah ditolak oleh HRD.{notes_text}",
                tipe_notifikasi="cuti_rejected",
                referensi_id=cuti.kd_cuti,
                referensi_tipe="cuti"
            )
        except Exception as notif_err:
            print(f"Error creating notification: {notif_err}")
        
        return {
            "success": True,
            "message": "Cuti ditolak",
            "data": {
                "kd_cuti": cuti.kd_cuti,
                "status": cuti.status,
                "approved_by": cuti.approved_by,
                "approval_date": cuti.approval_date.isoformat() if cuti.approval_date else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# ===== LEMBUR APPROVAL ENDPOINTS =====

@router.get("/lembur/pending")
def get_pending_lembur(db: Session = Depends(get_db), current_user: Karyawan = Depends(get_current_user)):
    """Get all pending lembur requests"""
    # Verify user is HRD or Owner
    if not current_user.jabatan or current_user.jabatan.nama_jabatan not in ["HRD", "Owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        # Use explicit join to avoid ambiguity
        pending_lembur = db.query(LemburHistori).join(
            Karyawan, LemburHistori.kd_karyawan == Karyawan.kd_karyawan
        ).filter(
            LemburHistori.status == 'pending'
        ).all()
        
        result = []
        for l in pending_lembur:
            result.append({
                "kd_lembur": l.kd_lembur,
                "kd_karyawan": l.kd_karyawan,
                "nama_karyawan": l.karyawan.nama_karyawan,
                "jabatan": getattr(l.karyawan.jabatan, "nama_jabatan", "") if l.karyawan.jabatan else "",
                "tgl_lembur": l.tgl_lembur.isoformat() if l.tgl_lembur else None,
                "jam_lembur": l.jam_lembur,
                "alasan": l.alasan,
                "status": l.status,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            })
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/lembur/approve/{kd_lembur}")
def approve_lembur(kd_lembur: int, payload: ApprovalRequest, db: Session = Depends(get_db), 
                   current_user: Karyawan = Depends(get_current_user)):
    """Approve a pending lembur request"""
    # Verify user is HRD or Owner
    if not current_user.jabatan or current_user.jabatan.nama_jabatan not in ["HRD", "Owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        lembur = db.query(LemburHistori).filter(LemburHistori.kd_lembur == kd_lembur).first()
        if not lembur:
            raise HTTPException(status_code=404, detail="Lembur tidak ditemukan")
        
        if lembur.status != 'pending':
            raise HTTPException(status_code=400, detail=f"Lembur sudah di-{lembur.status}")
        
        # Update lembur status
        lembur.status = 'approved'
        lembur.approved_by = current_user.kd_karyawan
        lembur.approval_date = datetime.utcnow()
        db.add(lembur)
        db.commit()
        
        # Create notification for employee
        try:
            notif_repo = NotifikasiRepository(db)
            notes_text = f" Catatan: {payload.approval_notes}" if payload.approval_notes else ""
            notif_repo.create_notifikasi(
                kd_karyawan=lembur.kd_karyawan,
                judul="Lembur Disetujui",
                pesan=f"Pengajuan lembur Anda pada {lembur.tgl_lembur} selama {lembur.jam_lembur} jam telah disetujui oleh HRD.{notes_text}",
                tipe_notifikasi="lembur_approved",
                referensi_id=lembur.kd_lembur,
                referensi_tipe="lembur"
            )
        except Exception as notif_err:
            print(f"Error creating notification: {notif_err}")
        
        return {
            "success": True,
            "message": "Lembur disetujui",
            "data": {
                "kd_lembur": lembur.kd_lembur,
                "status": lembur.status,
                "approved_by": lembur.approved_by,
                "approval_date": lembur.approval_date.isoformat() if lembur.approval_date else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ===================== HRD DASHBOARD ENDPOINTS =====================

@router.get("/dashboard/summary")
def get_hrd_dashboard_summary(db: Session = Depends(get_db), 
                               current_user: Karyawan = Depends(get_current_user)):
    """Get HRD dashboard summary stats"""
    # Verify user is HRD or Owner
    user_role = getattr(current_user, "_token_role", None)
    is_owner = user_role == "owner"
    is_hrd = hasattr(current_user, "jabatan") and current_user.jabatan and current_user.jabatan.nama_jabatan == "HRD"
    
    if not (is_owner or is_hrd):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        from app.models.absensi_histori import AbsensiHistori
        from app.models.kontrak import Kontrak
        
        # Total karyawan
        total_karyawan = db.query(func.count(Karyawan.kd_karyawan)).scalar() or 0
        
        # Today's attendance (check both 'masuk' and 'hadir' status)
        today = date.today()
        today_present = db.query(func.count(AbsensiHistori.kd_absensi)).filter(
            cast(AbsensiHistori.tgl_absensi, Date) == today,
            AbsensiHistori.status.in_(['masuk', 'hadir'])  # Handle both formats
        ).scalar() or 0
        
        # Total lembur this month
        first_day = date(today.year, today.month, 1)
        last_day = date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
        
        total_lembur_month = db.query(func.sum(LemburHistori.jam_lembur)).filter(
            LemburHistori.tgl_lembur >= first_day,
            LemburHistori.tgl_lembur < last_day,
            LemburHistori.status == 'approved'
        ).scalar() or 0
        
        # Contracts expiring in 30 days
        expiring_soon = date.today()
        expiring_date = date(expiring_soon.year + (1 if expiring_soon.month == 12 else 0), 
                            (expiring_soon.month % 12) + 1, expiring_soon.day)
        
        contracts_expiring = db.query(func.count(Karyawan.kd_karyawan)).join(
            Kontrak, Karyawan.kd_kontrak == Kontrak.kd_kontrak
        ).filter(
            Kontrak.tgl_habis <= expiring_date,
            Kontrak.tgl_habis >= date.today()
        ).scalar() or 0
        
        return {
            "success": True,
            "total_karyawan": int(total_karyawan),
            "today_present": int(today_present),
            "total_lembur_month": float(total_lembur_month),
            "contracts_expiring": int(contracts_expiring)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard/top-sales")
def get_top_sales(limit: int = 5, db: Session = Depends(get_db),
                  current_user: Karyawan = Depends(get_current_user)):
    """Get top 5 sales for this month"""
    # Verify user is HRD or Owner
    user_role = getattr(current_user, "_token_role", None)
    is_owner = user_role == "owner"
    is_hrd = hasattr(current_user, "jabatan") and current_user.jabatan and current_user.jabatan.nama_jabatan == "HRD"
    
    if not (is_owner or is_hrd):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        from app.models.transaksi import Transaksi
        
        # Get current month date range
        today = date.today()
        first_day = date(today.year, today.month, 1)
        last_day = date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1)
        
        # Query top sales WITH foto
        top_sales = db.query(
            Karyawan.kd_karyawan,
            Karyawan.nama_karyawan,
            Karyawan.foto,
            func.count(Transaksi.kd_transaksi).label('total_sales'),
            func.sum(Transaksi.total_harga).label('total_revenue')
        ).join(
            Transaksi, Karyawan.kd_karyawan == Transaksi.kd_sales
        ).filter(
            cast(Transaksi.tanggal, Date) >= first_day,
            cast(Transaksi.tanggal, Date) < last_day
        ).group_by(
            Karyawan.kd_karyawan,
            Karyawan.nama_karyawan,
            Karyawan.foto
        ).order_by(
            func.sum(Transaksi.total_harga).desc()
        ).limit(limit).all()
        
        result = []
        for sale in top_sales:
            result.append({
                "kd_karyawan": sale.kd_karyawan,
                "nama_karyawan": sale.nama_karyawan,
                "foto": sale.foto,
                "total_sales": int(sale.total_sales),
                "total_revenue": float(sale.total_revenue or 0)
            })
        
        return {
            "success": True,
            "sales": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard/attendance-trends")
def get_attendance_trends(days: int = 30, db: Session = Depends(get_db),
                         current_user: Karyawan = Depends(get_current_user)):
    """Get attendance trends for last N days"""
    # Verify user is HRD or Owner
    user_role = getattr(current_user, "_token_role", None)
    is_owner = user_role == "owner"
    is_hrd = hasattr(current_user, "jabatan") and current_user.jabatan and current_user.jabatan.nama_jabatan == "HRD"
    
    if not (is_owner or is_hrd):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        from app.models.absensi_histori import AbsensiHistori
        from datetime import timedelta
        
        start_date = date.today() - timedelta(days=days)
        
        # Get attendance stats by date
        trends = db.query(
            cast(AbsensiHistori.tgl_absensi, Date).label('tanggal'),
            AbsensiHistori.status,
            func.count(AbsensiHistori.kd_absensi).label('count')
        ).filter(
            AbsensiHistori.tgl_absensi >= start_date
        ).group_by(
            cast(AbsensiHistori.tgl_absensi, Date),
            AbsensiHistori.status
        ).order_by(
            cast(AbsensiHistori.tgl_absensi, Date)
        ).all()
        
        # Format response
        formatted_trends = {}
        for trend in trends:
            date_str = str(trend.tanggal)
            if date_str not in formatted_trends:
                formatted_trends[date_str] = {"masuk": 0, "izin": 0, "sakit": 0, "cuti": 0, "alfa": 0}
            
            # Map status value to key (handle both old and new formats)
            status = trend.status.lower() if trend.status else "masuk"
            status_map = {
                "masuk": "masuk",
                "hadir": "masuk",  # Map old format
                "izin": "izin",
                "sakit": "sakit",
                "cuti": "cuti",
                "alfa": "alfa",
                "absen": "alfa"  # Map old format
            }
            key = status_map.get(status, "masuk")
            formatted_trends[date_str][key] = int(trend.count)
        
        return {
            "success": True,
            "trends": formatted_trends
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard/overtime-trends")
def get_overtime_trends(days: int = 30, db: Session = Depends(get_db),
                       current_user: Karyawan = Depends(get_current_user)):
    """Get overtime trends for last N days"""
    # Verify user is HRD or Owner
    user_role = getattr(current_user, "_token_role", None)
    is_owner = user_role == "owner"
    is_hrd = hasattr(current_user, "jabatan") and current_user.jabatan and current_user.jabatan.nama_jabatan == "HRD"
    
    if not (is_owner or is_hrd):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        from datetime import timedelta
        
        start_date = date.today() - timedelta(days=days)
        
        # Get overtime stats by date
        trends = db.query(
            cast(LemburHistori.tgl_lembur, Date).label('tanggal'),
            func.count(LemburHistori.kd_lembur).label('count'),
            func.sum(LemburHistori.jam_lembur).label('total_hours')
        ).filter(
            LemburHistori.tgl_lembur >= start_date,
            LemburHistori.status == 'approved'
        ).group_by(
            cast(LemburHistori.tgl_lembur, Date)
        ).order_by(
            cast(LemburHistori.tgl_lembur, Date)
        ).all()
        
        # Format response
        formatted_trends = []
        for trend in trends:
            formatted_trends.append({
                "tanggal": str(trend.tanggal),
                "count": int(trend.count),
                "total_hours": float(trend.total_hours or 0)
            })
        
        return {
            "success": True,
            "trends": formatted_trends
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard/expiring-contracts")
def get_expiring_contracts(days: int = 30, limit: int = 5, db: Session = Depends(get_db),
                          current_user: Karyawan = Depends(get_current_user)):
    """Get contracts expiring soon"""
    # Verify user is HRD or Owner
    user_role = getattr(current_user, "_token_role", None)
    is_owner = user_role == "owner"
    is_hrd = hasattr(current_user, "jabatan") and current_user.jabatan and current_user.jabatan.nama_jabatan == "HRD"
    
    if not (is_owner or is_hrd):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        from app.models.kontrak import Kontrak
        from datetime import timedelta
        
        today = date.today()
        expiring_date = today + timedelta(days=days)
        
        # Get expiring contracts - calculate days_left in Python after query
        contracts = db.query(
            Karyawan.kd_karyawan,
            Karyawan.nama_karyawan,
            Kontrak.masa_kontrak,
            Kontrak.tgl_mulai,
            Kontrak.tgl_habis
        ).join(
            Kontrak, Karyawan.kd_kontrak == Kontrak.kd_kontrak
        ).filter(
            Kontrak.tgl_habis <= expiring_date,
            Kontrak.tgl_habis >= today
        ).order_by(
            Kontrak.tgl_habis
        ).limit(limit).all()
        
        result = []
        for contract in contracts:
            days_left = 0
            if contract.tgl_habis:
                days_left = (contract.tgl_habis - today).days
            result.append({
                "kd_karyawan": contract.kd_karyawan,
                "nama_karyawan": contract.nama_karyawan,
                "masa_kontrak": contract.masa_kontrak,
                "tgl_mulai": str(contract.tgl_mulai) if contract.tgl_mulai else None,
                "tgl_habis": str(contract.tgl_habis) if contract.tgl_habis else None,
                "days_left": max(0, days_left)
            })
        
        return {
            "success": True,
            "contracts": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/lembur/reject/{kd_lembur}")
def reject_lembur(kd_lembur: int, payload: ApprovalRequest, db: Session = Depends(get_db), 
                  current_user: Karyawan = Depends(get_current_user)):
    """Reject a pending lembur request"""
    # Verify user is HRD or Owner
    if not current_user.jabatan or current_user.jabatan.nama_jabatan not in ["HRD", "Owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya HRD/Owner yang bisa akses")
    
    try:
        lembur = db.query(LemburHistori).filter(LemburHistori.kd_lembur == kd_lembur).first()
        if not lembur:
            raise HTTPException(status_code=404, detail="Lembur tidak ditemukan")
        
        if lembur.status != 'pending':
            raise HTTPException(status_code=400, detail=f"Lembur sudah di-{lembur.status}")
        
        # Update lembur status
        lembur.status = 'rejected'
        lembur.approved_by = current_user.kd_karyawan
        lembur.approval_date = datetime.utcnow()
        db.add(lembur)
        db.commit()
        
        # Create notification for employee
        try:
            notif_repo = NotifikasiRepository(db)
            notes_text = f" Alasan: {payload.approval_notes}" if payload.approval_notes else ""
            notif_repo.create_notifikasi(
                kd_karyawan=lembur.kd_karyawan,
                judul="Lembur Ditolak",
                pesan=f"Pengajuan lembur Anda pada {lembur.tgl_lembur} selama {lembur.jam_lembur} jam telah ditolak oleh HRD.{notes_text}",
                tipe_notifikasi="lembur_rejected",
                referensi_id=lembur.kd_lembur,
                referensi_tipe="lembur"
            )
        except Exception as notif_err:
            print(f"Error creating notification: {notif_err}")
        
        return {
            "success": True,
            "message": "Lembur ditolak",
            "data": {
                "kd_lembur": lembur.kd_lembur,
                "status": lembur.status,
                "approved_by": lembur.approved_by,
                "approval_date": lembur.approval_date.isoformat() if lembur.approval_date else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
