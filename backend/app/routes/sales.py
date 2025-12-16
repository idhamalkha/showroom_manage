from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.exc import DataError, SQLAlchemyError

from app.database.connection import get_db
from app.repositories.sales_repository import SalesRepository
from app.repositories.bonus_repository import BonusRepository
from app.models.transaksi import Transaksi
from app.models.transaksi_detail import TransaksiDetail
from app.models.mobil import Mobil
from app.models.bonus import Bonus
from app.models.kelas_mobil import KelasMobil
from app.schemas.sales import TransaksiCreate, TransaksiDetailCreate, MobilCreate, MobilUpdate
from app.utils.permissions import require_role
from fastapi.security import OAuth2PasswordBearer
from app.utils.security import get_current_user, get_current_user_optional
from app.utils.bonus import calculate_sales_bonus
import logging
import traceback
logger = logging.getLogger(__name__)
from app.utils.email import send_email
from app.utils.invoice import render_invoice_html, generate_pdf
from fastapi.responses import Response

router = APIRouter(prefix="/sales", tags=["Sales"])

# allow optional token for certain public endpoints (auto_error=False)
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


class CicilanCreate(BaseModel):
    jumlah_cicilan: float
    tenor: int
    tgl_jatuh_tempo: date | None = None


@router.post("/transaksi/{kd_transaksi}/cicilan", status_code=201)
def create_cicilan_for_transaksi(kd_transaksi: int, payload: CicilanCreate, db: Session = Depends(get_db)):
    # create a Cicilan row linked to existing transaksi
    from app.models.cicilan import Cicilan
    try:
        # Insert cicilan
        obj = Cicilan(kd_transaksi=kd_transaksi, jumlah_cicilan=payload.jumlah_cicilan, tenor=payload.tenor, tgl_jatuh_tempo=payload.tgl_jatuh_tempo, status='pending')
        db.add(obj)
        # Insert DP ke payment jika ada DP di payload
        dp_amount = getattr(payload, 'dp', None)
        if dp_amount and dp_amount > 0:
            from app.models.payment import Payment
            from datetime import datetime
            payment_dp = Payment(
                kd_transaksi=kd_transaksi,
                jumlah=dp_amount,
                jenis='dp',
                tanggal=datetime.now().date(),
                status='completed',
                reference='DP cicilan',
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.add(payment_dp)
        db.commit()
        db.refresh(obj)
        return {"kd_cicilan": obj.kd_cicilan, "kd_transaksi": obj.kd_transaksi, "jumlah_cicilan": float(obj.jumlah_cicilan), "tenor": obj.tenor}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create cicilan")


@router.post("/transaksi")
def create_transaksi(payload: TransaksiCreate, db: Session = Depends(get_db)):
    try:
        repo = SalesRepository(db)
        
        # Prepare header data
        header_data = {
            "kd_client": payload.kd_client,
            "kd_sales": payload.kd_sales,
            "tanggal": payload.tanggal,
            "metode_pembayaran": payload.metode_pembayaran or None,
            "status": None  # or set default status
        }

        # Prepare details data
        details_data = [detail.dict() for detail in payload.details]

        # Pass both header and details to create_transaksi
        created_transaksi = repo.create_transaksi(header_data, details_data)

        # Untuk setiap detail, hitung dan tambahkan bonus
        for detail in created_transaksi.details:
            harga = float(detail.harga or 0)
            kd_bonus_from_mobil = getattr(detail.mobil, "kd_bonus", None)
            repo.add_bonus_to_payroll(kd_karyawan=payload.kd_sales, harga=harga, kd_bonus=kd_bonus_from_mobil)

        # Jika frontend mengirim DP dalam payload, persist DP dan pembayaran DP
        try:
            dp_val = getattr(payload, 'dp', None)
            if dp_val and float(dp_val) > 0:
                from app.models.dp import DP as DPModel
                from app.models.payment import Payment as PaymentModel
                from datetime import datetime
                # create DP record
                dp_row = DPModel(kd_transaksi=created_transaksi.kd_transaksi, jumlah=float(dp_val), tanggal=created_transaksi.tanggal, status='paid', created_at=datetime.now(), updated_at=datetime.now())
                db.add(dp_row)
                db.commit()
                db.refresh(dp_row)
                
                # Reload transaksi from DB to get invoices relationship loaded
                db.refresh(created_transaksi)
                
                # Get invoice kd from transaksi (auto-created by create_transaksi)
                kd_invoice_from_transaksi = None
                if hasattr(created_transaksi, 'invoices') and created_transaksi.invoices:
                    # Filter untuk main invoice (bukan DP atau cicilan invoice)
                    for inv in created_transaksi.invoices:
                        if hasattr(inv, 'nomor_invoice') and not inv.nomor_invoice.startswith(('INV-DP-', 'INV-CICILAN-')):
                            kd_invoice_from_transaksi = inv.kd_invoice
                            break
                
                # create payment record for DP with kd_invoice
                payment_dp = PaymentModel(
                    kd_transaksi=created_transaksi.kd_transaksi,
                    kd_invoice=kd_invoice_from_transaksi,
                    kd_client=created_transaksi.kd_client,
                    jumlah=float(dp_val),
                    jenis='dp',
                    tanggal=created_transaksi.tanggal,
                    status='completed',
                    reference=f"DP-{created_transaksi.kd_transaksi}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.add(payment_dp)
                db.commit()
                db.refresh(payment_dp)
                # attach dp relationship on object for later reading
                created_transaksi.dp = dp_row
        except Exception:
            # non-fatal: log and continue
            logger.exception('failed to persist DP from payload')

        # Build explicit response that includes kd_transaksi and invoice_id so frontend can rely on them
        try:
            resp_details = []
            for d in created_transaksi.details:
                mobil = getattr(d, 'mobil', None)
                resp_details.append({
                    'kd_detail': getattr(d, 'kd_detail', None),
                    'kd_mobil': getattr(d, 'kd_mobil', None),
                    'nama_mobil': getattr(mobil, 'nama_mobil', None) if mobil else None,
                    'harga': float(getattr(d, 'harga', 0) or 0),
                    'jumlah': int(getattr(d, 'jumlah', 1) or 1),
                    'subtotal': float(getattr(d, 'subtotal', 0) or 0)
                })

            # Ambil harga dari detail pertama
            harga = resp_details[0]['harga'] if resp_details else 0
            # Default dp, cicilan, tenor, estimasi_per_bulan
            dp = 0
            jumlah_cicilan = 0
            tenor = 0
            estimasi_per_bulan = 0
            # Jika metode cicilan, ambil dari payload
            if payload.metode_pembayaran and payload.metode_pembayaran.lower() == 'cicilan':
                dp = getattr(payload, 'dp', 0) or 0
                jumlah_cicilan = getattr(payload, 'jumlah_cicilan', 0) or (harga - dp)
                tenor = getattr(payload, 'tenor', 0) or 0
                estimasi_per_bulan = jumlah_cicilan / tenor if tenor else 0
            else:
                # Ambil DP dari relasi dp
                dp_obj = getattr(created_transaksi, 'dp', None)
                dp = float(dp_obj.jumlah) if dp_obj and hasattr(dp_obj, 'jumlah') else 0
                # Ambil cicilan dari relasi cicilan
                cicilan_obj = created_transaksi.cicilan[0] if hasattr(created_transaksi, 'cicilan') and created_transaksi.cicilan else None
                jumlah_cicilan = float(cicilan_obj.jumlah_cicilan) if cicilan_obj and hasattr(cicilan_obj, 'jumlah_cicilan') else 0
                tenor = cicilan_obj.tenor if cicilan_obj and hasattr(cicilan_obj, 'tenor') else 0
                estimasi_per_bulan = jumlah_cicilan / tenor if tenor else 0

            response_payload = {
                'kd_transaksi': created_transaksi.kd_transaksi,
                'invoice_id': f"INV-{created_transaksi.kd_transaksi}",
                'tanggal': created_transaksi.tanggal,
                'total': float(created_transaksi.total_harga or 0),
                'details': resp_details,
                'harga': harga,
                'dp': dp,
                'jumlah_cicilan': jumlah_cicilan,
                'tenor': tenor,
                'estimasi_per_bulan': estimasi_per_bulan
            }
            return response_payload
        except Exception:
            # Fallback: return a minimal response with the id only
            return { 'kd_transaksi': getattr(created_transaksi, 'kd_transaksi', None) }
    except Exception as e:
        logger.exception(f"Error creating transaksi: {str(e)}")
        raise HTTPException(status_code=400, detail="Gagal menyimpan transaksi")


class SendInvoicePayload(BaseModel):
    to_email: str
    attach_pdf: bool = False
    # optional from address override; if omitted, server env or default will be used
    from_email: Optional[str] = None


@router.post('/transaksi/{kd_transaksi}/send-invoice')
def send_transaksi_invoice(kd_transaksi: int, payload: SendInvoicePayload, db: Session = Depends(get_db)):
        """Compose a simple HTML invoice from transaksi, client, sales and details and send via SMTP.

        SMTP credentials must be configured via environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
        """
        # Query transaksi and related models
        t = db.query(Transaksi).filter(Transaksi.kd_transaksi == kd_transaksi).first()
        if not t:
                raise HTTPException(status_code=404, detail='Transaksi not found')

        client = getattr(t, 'client', None)
        sales = getattr(t, 'sales', None)
        details = getattr(t, 'details', [])

        # Build invoice HTML using the renderer util (produces a cleaner template)
        # Map details to a serializable list of dicts
        mapped_details = []
        mobil_info = None
        for d in details:
                mobil = getattr(d, 'mobil', None)
                nama = getattr(mobil, 'nama_mobil', f"Mobil #{getattr(d, 'kd_mobil', '')}")
                harga = float(getattr(d, 'harga', 0) or 0)
                jumlah = int(getattr(d, 'jumlah', 1) or 1)
                subtotal = float(getattr(d, 'subtotal', harga * jumlah) or (harga * jumlah))
                mapped_details.append({
                    'nama': nama,
                    'qty': jumlah,
                    'harga': harga,
                    'subtotal': subtotal
                })
                if not mobil_info and mobil:
                    # pick first mobil object for more detailed view if available
                    mobil_info = {
                        'nama_mobil': getattr(mobil, 'nama_mobil', None),
                        'kd_mobil': getattr(mobil, 'kd_mobil', None),
                        'harga_mobil': float(getattr(mobil, 'harga_mobil', 0) or 0),
                        'tahun_keluaran': getattr(mobil, 'tahun_keluaran', None),
                        'engine_cc': getattr(mobil, 'engine_cc', None),
                    }

        html = render_invoice_html(t, client, sales, mapped_details, mobil=mobil_info)

        # If attach_pdf requested, try to generate PDF
        attachments = None
        if payload.attach_pdf:
            try:
                pdf_bytes = generate_pdf(html)
                attachments = [{'filename': f'invoice_{t.kd_transaksi}.pdf', 'content': pdf_bytes, 'mime': 'application/pdf'}]
            except Exception as e:
                logger.exception('Failed to generate invoice PDF: %s', str(e))
                # continue without attachment but inform client

        try:
                send_email(payload.to_email, f"Invoice Transaksi #{t.kd_transaksi}", html, from_email=payload.from_email, attachments=attachments)
        except Exception as e:
                logger.exception('failed to send invoice email')
                raise HTTPException(status_code=500, detail=str(e))

        return {"sent": True, "pdf_attached": bool(attachments)}


@router.get('/transaksi/{kd_transaksi}/invoice.pdf')
def get_transaksi_invoice_pdf(kd_transaksi: int, db: Session = Depends(get_db)):
    """Return generated PDF invoice for a transaksi. Requires WeasyPrint to be installed."""
    t = db.query(Transaksi).filter(Transaksi.kd_transaksi == kd_transaksi).first()
    if not t:
        raise HTTPException(status_code=404, detail='Transaksi not found')
    client = getattr(t, 'client', None)
    sales = getattr(t, 'sales', None)
    details = getattr(t, 'details', [])

    # map details
    mapped_details = []
    mobil_info = None
    for d in details:
        mobil = getattr(d, 'mobil', None)
        nama = getattr(mobil, 'nama_mobil', f"Mobil #{getattr(d, 'kd_mobil', '')}")
        harga = float(getattr(d, 'harga', 0) or 0)
        jumlah = int(getattr(d, 'jumlah', 1) or 1)
        subtotal = float(getattr(d, 'subtotal', harga * jumlah) or (harga * jumlah))
        mapped_details.append({'nama': nama, 'qty': jumlah, 'harga': harga, 'subtotal': subtotal})
        if not mobil_info and mobil:
            mobil_info = {'nama_mobil': getattr(mobil, 'nama_mobil', None)}

    html = render_invoice_html(t, client, sales, mapped_details, mobil=mobil_info)
    try:
        pdf_bytes = generate_pdf(html)
    except Exception as e:
        logger.exception('PDF generation failed: %s', str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return Response(content=pdf_bytes, media_type='application/pdf')


@router.get("/target/{kd_karyawan}")
def get_target_sales(
    kd_karyawan: int,
    periode: str | None = None,
    db: Session = Depends(get_db),
    current_user = require_role(["Sales", "Owner"])
):
    # jika user Sales, pastikan hanya akses target sendiri
    if "Sales" in (current_user.jabatan.nama_jabatan if current_user.jabatan else "") and current_user.kd_karyawan != kd_karyawan:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tidak diizinkan melihat target karyawan lain")

    repo = SalesRepository(db)
    try:
        target = repo.get_target_sales(kd_karyawan, periode)
    except ValueError as e:
        # invalid periode format
        raise HTTPException(status_code=400, detail=str(e))
    except DataError as e:
        # DB rejected input (e.g. invalid date string)
        raise HTTPException(status_code=400, detail="Invalid periode value")
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail="Database error")

    if not target:
        raise HTTPException(status_code=404, detail="Target tidak ditemukan")
    return target


@router.get("/mobil")
def get_all_mobil(kd_merek: Optional[int] = None, db: Session = Depends(get_db)):
    repo = SalesRepository(db)
    if kd_merek:
        return repo.get_mobil_by_merek(int(kd_merek))
    return repo.get_all_mobil()


@router.get("/mobil/{kd_mobil}")
def get_mobil(kd_mobil: int, db: Session = Depends(get_db)):
    """Return a single mobil by kd_mobil for debugging and quick checks."""
    m = db.query(Mobil).filter_by(kd_mobil=kd_mobil).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Mobil with kd_mobil={kd_mobil} not found")
    return {
        "kd_mobil": m.kd_mobil,
        "nama_mobil": m.nama_mobil,
        "kelas_mobil": m.kelas_mobil,
        "kd_kelas": m.kd_kelas,
        "harga_mobil": float(m.harga_mobil) if m.harga_mobil is not None else None,
        "foto_url": m.foto_url,
        "video_url": m.video_url,
        "kd_merek": m.kd_merek,
        "engine_cc": m.engine_cc,
        "power_ps": m.power_ps,
        "tahun_keluaran": m.tahun_keluaran,
        "harga_off_road": float(m.harga_off_road) if getattr(m, "harga_off_road", None) is not None else None,
        "harga_on_road": float(m.harga_on_road) if getattr(m, "harga_on_road", None) is not None else None,
        "transmisi": getattr(m, "transmisi", None),
        "seats": getattr(m, "seats", None),
        "drivetrain": getattr(m, "drivetrain", None),
        "warna_tersedia": getattr(m, "warna_tersedia", None),
        "status": getattr(m, "status", None),
        "jenis_bahan_bakar": getattr(m, "jenis_bahan_bakar", None),
    }


@router.post("/mobil", status_code=201)
def create_mobil(m: MobilCreate, db: Session = Depends(get_db)):
    repo = SalesRepository(db)
    # if client didn't send kd_bonus, compute and create/get Bonus row
    if getattr(m, "kd_bonus", None) is None:
        harga = getattr(m, "harga_mobil", None) or 0
        bonus_repo = BonusRepository(db)
        bonus_row = bonus_repo.get_or_create_for_price(harga)
        # set kd_bonus on Pydantic model before persisting
        m.kd_bonus = int(bonus_row.kd_bonus)
    try:
        mobil = repo.create_mobil(m)
    except Exception as e:
        logger.exception("failed creating mobil")
        # during development it's helpful to return DB error text; change to generic message in production
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # build response dict from SQLAlchemy object (avoid .to_dict())
    resp = {
        "kd_mobil": getattr(mobil, "kd_mobil", None),
        "nama_mobil": getattr(mobil, "nama_mobil", None),
        "kelas_mobil": getattr(mobil, "kelas_mobil", None),
        "harga_mobil": float(mobil.harga_mobil) if getattr(mobil, "harga_mobil", None) is not None else None,
        "foto_url": getattr(mobil, "foto_url", None),
        "video_url": getattr(mobil, "video_url", None),
        "kd_merek": getattr(mobil, "kd_merek", None),
        "kd_kelas": getattr(mobil, "kd_kelas", None),
        "engine_cc": getattr(mobil, "engine_cc", None),
        "power_ps": getattr(mobil, "power_ps", None),
        "tahun_keluaran": getattr(mobil, "tahun_keluaran", None),
        "harga_off_road": float(mobil.harga_off_road) if getattr(mobil, "harga_off_road", None) is not None else None,
        "harga_on_road": float(mobil.harga_on_road) if getattr(mobil, "harga_on_road", None) is not None else None,
        "transmisi": getattr(mobil, "transmisi", None),
        "seats": getattr(mobil, "seats", None),
        "drivetrain": getattr(mobil, "drivetrain", None),
        "warna_tersedia": getattr(mobil, "warna_tersedia", None),
        "status": getattr(mobil, "status", None),
        "kd_bonus": getattr(mobil, "kd_bonus", None),
        "jenis_bahan_bakar": getattr(mobil, "jenis_bahan_bakar", None),
    }
    # attach computed bonus info if available
    try:
        if resp.get("kd_bonus"):
            b = db.query(Bonus).filter_by(kd_bonus=resp["kd_bonus"]).first()
            if b:
                resp["computed_bonus"] = {
                    "kd_bonus": b.kd_bonus,
                    "percent": str(getattr(b, "persen", 0)),
                    "amount": str(getattr(b, "jumlah_bonus", 0))
                }
    except Exception:
        # keep response even if bonus lookup fails
        pass
    return resp


@router.put("/mobil/{kd_mobil}")
def update_mobil(kd_mobil: int, data: MobilUpdate, db: Session = Depends(get_db)):
    repo = SalesRepository(db)
    patch = data.dict(exclude_unset=True)
    logger.info("PUT /sales/mobil/%s payload keys=%s", kd_mobil, list(patch.keys()))
    try:
        return repo.update_mobil(kd_mobil, patch)
    except ValueError as e:
        logger.warning("update_mobil ValueError: %s", str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error updating mobil %s", kd_mobil)
        raise HTTPException(status_code=500, detail="Mobil tidak ditemukan atau gagal diupdate")


@router.delete("/mobil/{kd_mobil}")
def delete_mobil(kd_mobil: int, db: Session = Depends(get_db)):
    repo = SalesRepository(db)
    try:
        repo.delete_mobil(kd_mobil)
    except Exception:
        raise HTTPException(status_code=404, detail="Mobil tidak ditemukan atau gagal dihapus")
    return {"message": "Mobil dihapus"}


@router.get("/dashboard/summary")
async def get_dashboard_summary(
    start: Optional[date] = None,
    end: Optional[date] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Fetching sales dashboard summary")
        kd_karyawan = current_user.kd_karyawan
        sales_repo = SalesRepository(db)
        summary = sales_repo.get_dashboard_summary(kd_karyawan=kd_karyawan, start_date=start, end_date=end)
        return summary
    except Exception as e:
        # log full traceback for debugging
        tb = traceback.format_exc()
        logger.error(f"Error in get_dashboard_summary: {str(e)}")
        logger.error(tb)
        # return generic message to client but full details are in server log
        raise HTTPException(
            status_code=500, 
            detail="Internal server error. Check server logs for traceback."
        )


@router.get("/dashboard/recent-transactions")
async def get_recent_transactions(
    limit: int = 3,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Fetching recent transactions for dashboard")
        sales_repo = SalesRepository(db)
        kd_sales = None
        # Only filter if user is sales
        if hasattr(current_user, "_token_role") and getattr(current_user, "_token_role", None) == "karyawan":
            # Only filter if jabatan sales
            jabatan = getattr(current_user, "jabatan", None)
            if jabatan and getattr(jabatan, "nama_jabatan", "").lower() == "sales":
                kd_sales = getattr(current_user, "kd_karyawan", None)
        transactions = sales_repo.get_recent_transactions(limit=limit, kd_sales=kd_sales)
        return {"transactions": transactions}
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error in get_recent_transactions: {str(e)}")
        logger.error(tb)
        raise HTTPException(
            status_code=500,
            detail="Internal server error. Check server logs for traceback."
        )


@router.get("/dashboard/top-vehicles")
async def get_top_vehicles(
    limit: int = 5,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Fetching top vehicles")
        sales_repo = SalesRepository(db)
        vehicles = sales_repo.get_top_vehicles(limit=limit)
        return {"vehicles": vehicles}
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error in get_top_vehicles: {str(e)}")
        logger.error(tb)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/payment-methods")
async def get_payment_methods(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Fetching payment methods breakdown")
        sales_repo = SalesRepository(db)
        methods = sales_repo.get_payment_methods_breakdown()
        return {"methods": methods}
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error in get_payment_methods: {str(e)}")
        logger.error(tb)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/sales-trend")
async def get_sales_trend(
    days: int = 7,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Fetching sales trend")
        sales_repo = SalesRepository(db)
        trend = sales_repo.get_daily_sales_trend(days=days)
        return {"trend": trend}
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error in get_sales_trend: {str(e)}")
        logger.error(tb)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/conversion-rate")
async def get_conversion_rate(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Fetching conversion rate")
        sales_repo = SalesRepository(db)
        data = sales_repo.get_conversion_rate()
        return data
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error in get_conversion_rate: {str(e)}")
        logger.error(tb)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/kelas_mobil", tags=["master"])
def list_kelas_mobil(db: Session = Depends(get_db)):
    rows = db.query(KelasMobil).order_by(KelasMobil.nama).all()
    return [
        {
            "kd_kelas": r.kd_kelas,
            "kode": r.kode,
            "nama": r.nama,
            "deskripsi": r.deskripsi
        } for r in rows
    ]


@router.get("/transaksi/{kd_transaksi}/invoice")
def get_transaksi_invoice(kd_transaksi: int, db: Session = Depends(get_db)):
    """Get invoice details for a transaction"""
    t = db.query(Transaksi).filter(Transaksi.kd_transaksi == kd_transaksi).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
        
    # Get related data
    client = getattr(t, 'client', None)
    sales = getattr(t, 'sales', None)
    details = getattr(t, 'details', [])

    # Map details for response
    mapped_details = []
    for d in details:
        mobil = getattr(d, 'mobil', None)
        mapped_details.append({
            'nama_mobil': getattr(mobil, 'nama_mobil', None),
            'harga': float(d.harga) if d.harga else 0,
            'jumlah': d.jumlah or 1,
            'subtotal': float(d.subtotal) if d.subtotal else 0
        })

    return {
        "invoice_id": f"INV-{t.kd_transaksi}",
        "tanggal": t.tanggal,
        "client": {
            "nama": getattr(client, 'nama_client', None),
        },
        "sales": {
            "nama": getattr(sales, 'nama_karyawan', None)
        },
        "details": mapped_details,
        "total": float(t.total_harga) if t.total_harga else 0,
        "metode_pembayaran": t.metode_pembayaran,
        "status": t.status
    }