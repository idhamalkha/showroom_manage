from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.repositories.finance_repository import FinanceRepository
from app.repositories.mutasi_repository import MutasiRepository
from app.utils.security import get_current_user
from app.utils.permissions import require_role
from pydantic import BaseModel
from fastapi.responses import Response
from typing import List
from datetime import date, datetime
import logging
from app.schemas.finance import PaymentCreate, PaymentOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/finance", tags=["Finance"])

# Endpoint: Buat invoice manual
class ManualInvoiceCreate(BaseModel):
    kd_client: int
    tanggal: str
    total_amount: float
    due_days: int = 30

@router.post('/invoices/manual')
def create_manual_invoice(payload: ManualInvoiceCreate, db: Session = Depends(get_db)):
    try:
        repo = FinanceRepository(db)
        tanggal = datetime.strptime(payload.tanggal, "%Y-%m-%d").date()
        invoice = repo.create_manual_invoice(
            kd_client=payload.kd_client,
            tanggal=tanggal,
            total_amount=payload.total_amount,
            due_days=payload.due_days
        )
        return {
            "kd_invoice": invoice.kd_invoice,
            "nomor_invoice": invoice.nomor_invoice,
            "status": invoice.status,
            "total_amount": float(invoice.total_amount),
            "tanggal_jatuh_tempo": invoice.tanggal_jatuh_tempo.isoformat() if invoice.tanggal_jatuh_tempo else None,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        }
    except Exception as e:
        logger.exception("Error in create_manual_invoice: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error while creating manual invoice")

# Laporan Aging Invoice
@router.get("/report/aging")
def report_aging(db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    return repo.get_aging_report()

# Laporan Cashflow
@router.get("/report/cashflow")
def report_cashflow(start: str, end: str, db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    from datetime import datetime
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    return repo.get_cashflow_report(start_date, end_date)

# Laporan Penjualan
@router.get("/report/sales")
def report_sales(start: str, end: str, db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    from datetime import datetime
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    return repo.get_sales_report(start_date, end_date)

# Upload mutasi bank (CSV) dan rekonsiliasi otomatis
@router.post("/mutasi/upload")
async def upload_mutasi(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = (await file.read()).decode("utf-8")
    repo = MutasiRepository(db)
    mutasi = repo.parse_mutasi_csv(content)
    return {"mutasi": mutasi}

# Rekonsiliasi mutasi dengan payment
@router.post("/mutasi/reconcile")
async def reconcile_mutasi(mutasi: list, db: Session = Depends(get_db)):
    repo = MutasiRepository(db)
    results = repo.reconcile(mutasi)
    return {"results": results}

@router.get("/payment/pending")
def get_pending_payments(db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    payments = repo.get_pending_payments()
    return {"payments": [
        {
            "kd_payment": p.kd_payment,
            "jumlah": float(p.jumlah),
            "jenis": p.jenis,
            "tanggal": p.tanggal,
            "status": p.status,
            "reference": p.reference,
            "note": p.note,
            "approval_status": p.approval_status,
            "created_at": p.created_at,
            "kd_invoice": p.kd_invoice,
            "kd_transaksi": p.kd_transaksi
        } for p in payments
    ]}

@router.post("/payment/{kd_payment}/approve")
def approve_payment(kd_payment: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    payment = repo.approve_payment(kd_payment, getattr(current_user, "kd_karyawan", None))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"status": "approved", "kd_payment": kd_payment}

@router.post("/payment/{kd_payment}/reject")
def reject_payment(kd_payment: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    payment = repo.reject_payment(kd_payment, getattr(current_user, "kd_karyawan", None))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"status": "rejected", "kd_payment": kd_payment}

@router.post('/payments', response_model=PaymentOut, status_code=201)
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    data = payload.dict()
    try:
        # default tanggal to today if not provided
        if data.get('tanggal') is None:
            from datetime import date
            data['tanggal'] = date.today()
        p = repo.create_payment(data)
        # return serializable dict
        return {
            "kd_payment": p.kd_payment,
            "kd_transaksi": p.kd_transaksi,
            "jumlah": float(p.jumlah) if p.jumlah is not None else 0.0,
            "jenis": p.jenis,
            "tanggal": p.tanggal.isoformat() if getattr(p, 'tanggal', None) else None,
            "status": p.status,
            "reference": p.reference,
            "note": p.note,
        }
    except Exception as e:
        logger.exception('Failed creating payment')
        raise HTTPException(status_code=500, detail='Failed creating payment')


@router.get('/payments')
def list_payments(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    try:
        repo = FinanceRepository(db)
        rows = repo.list_payments(limit=limit, offset=offset)
        out = []
        for p in rows:
            try:
                client_name = p.client.nama_client if getattr(p, 'client', None) and getattr(p.client, 'nama_client', None) else None
                # Resolve invoice code: dari invoice relationship atau dari kd_invoice
                invoice_code = None
                if hasattr(p, 'invoice') and p.invoice and hasattr(p.invoice, 'kd_invoice'):
                    invoice_code = f"INV-{p.invoice.kd_invoice}"
                elif p.kd_invoice:
                    invoice_code = f"INV-{p.kd_invoice}"
                out.append({
                    "kd_payment": p.kd_payment,
                    "kd_transaksi": p.kd_transaksi,
                    "kd_invoice": p.kd_invoice,
                    "invoice_code": invoice_code,
                    "kd_client": p.kd_client,
                    "client_name": client_name,
                    "jumlah": float(p.jumlah) if p.jumlah is not None else 0.0,
                    "jenis": p.jenis,
                    "tanggal": p.tanggal.isoformat() if getattr(p, 'tanggal', None) else None,
                    "status": p.status,
                    "reference": p.reference,
                    "note": p.note,
                })
            except Exception:
                logger.exception("Failed serializing payment kd=%s", getattr(p, 'kd_payment', None))
        return {"payments": out}
    except Exception as e:
        logger.exception("Error in list_payments: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error while listing payments")


@router.get('/payments/{kd_payment}/invoice')
def get_payment_invoice(kd_payment: int, db: Session = Depends(get_db)):
    repo = FinanceRepository(db)
    pdf = repo.generate_invoice_pdf_for_payment(kd_payment)
    if not pdf:
        raise HTTPException(status_code=404, detail='Invoice not found')
    return Response(content=pdf, media_type='application/pdf')


# --- Invoice Management Endpoints ---
@router.get('/invoices')
def list_outstanding_invoices(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Get list of outstanding and partially paid invoices"""
    try:
        repo = FinanceRepository(db)
        invoices = repo.get_outstanding_invoices(limit=limit, offset=offset)
        out = []
        for inv in invoices:
            try:
                transaksi = inv.transaksi if hasattr(inv, 'transaksi') else None
                client_name = transaksi.client.nama_client if transaksi and hasattr(transaksi, 'client') and transaksi.client else "Unknown"
                
                out.append({
                    "kd_invoice": inv.kd_invoice,
                    "kd_transaksi": inv.kd_transaksi,
                    "nomor_invoice": inv.nomor_invoice,
                    "status": inv.status,
                    "total_amount": float(inv.total_amount),
                    "paid_amount": float(inv.paid_amount or 0),
                    "remaining": float(inv.total_amount) - float(inv.paid_amount or 0),
                    "tanggal_jatuh_tempo": inv.tanggal_jatuh_tempo.isoformat() if inv.tanggal_jatuh_tempo else None,
                    "client_name": client_name,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                })
            except Exception as e:
                logger.exception("Failed serializing invoice kd=%s: %s", getattr(inv, 'kd_invoice', None), str(e))
        return {"invoices": out}
    except Exception as e:
        logger.exception("Error in list_outstanding_invoices: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error while listing invoices")


@router.get('/invoices/aging')
def get_aging_report(db: Session = Depends(get_db)):
    """Get aging report with buckets: current, 30-60, 60-90, 90+ days overdue"""
    try:
        repo = FinanceRepository(db)
        buckets = repo.get_aging_report()
        return {
            "current": buckets["current"],
            "days_30_60": buckets["30_60"],
            "days_60_90": buckets["60_90"],
            "days_90_plus": buckets["90_plus"],
            "total": {
                "count": sum([b["count"] for b in buckets.values()]),
                "amount": sum([b["amount"] for b in buckets.values()])
            }
        }
    except Exception as e:
        logger.exception("Error in get_aging_report: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error while calculating aging report")


@router.get('/invoices/{kd_invoice}')
def get_invoice_detail(kd_invoice: int, db: Session = Depends(get_db)):
    """Get invoice detail with all related payments"""
    try:
        repo = FinanceRepository(db)
        result = repo.get_invoice_with_payments(kd_invoice)
        
        if not result:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        inv = result["invoice"]
        payments = result["payments"]
        
        payment_list = []
        for p in payments:
            try:
                payment_list.append({
                    "kd_payment": p.kd_payment,
                    "jumlah": float(p.jumlah) if p.jumlah else 0.0,
                    "jenis": p.jenis,
                    "tanggal": p.tanggal.isoformat() if p.tanggal else None,
                    "reference": p.reference,
                    "note": p.note,
                })
            except Exception:
                logger.exception("Failed serializing payment in invoice detail")
        
        return {
            "invoice": {
                "kd_invoice": inv.kd_invoice,
                "nomor_invoice": inv.nomor_invoice,
                "status": inv.status,
                "total_amount": float(inv.total_amount),
                "paid_amount": float(inv.paid_amount or 0),
                "remaining": float(result["remaining"]),
                "tanggal_jatuh_tempo": inv.tanggal_jatuh_tempo.isoformat() if inv.tanggal_jatuh_tempo else None,
            },
            "payments": payment_list
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_invoice_detail: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error while fetching invoice detail")


@router.post('/invoices/{kd_invoice}/pay')
def record_payment_to_invoice(kd_invoice: int, payload: PaymentCreate, db: Session = Depends(get_db)):
    """Record payment against a specific invoice"""
    try:
        repo = FinanceRepository(db)
        data = payload.dict()
        
        # Set tanggal to today if not provided
        if data.get('tanggal') is None:
            data['tanggal'] = date.today()
        
        result = repo.record_payment_to_invoice(kd_invoice, data)
        
        if not result:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        p = result["payment"]
        inv = result["invoice"]
        
        return {
            "payment": {
                "kd_payment": p.kd_payment,
                "jumlah": float(p.jumlah) if p.jumlah else 0.0,
                "jenis": p.jenis,
                "tanggal": p.tanggal.isoformat() if p.tanggal else None,
            },
            "invoice": {
                "kd_invoice": inv.kd_invoice,
                "status": inv.status,
                "paid_amount": float(inv.paid_amount or 0),
                "remaining": float(inv.total_amount) - float(inv.paid_amount or 0),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in record_payment_to_invoice: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed recording payment to invoice")


@router.post('/invoices/generate-from-transactions')
def generate_invoices_from_transactions(db: Session = Depends(get_db)):
    """Auto-generate invoices from existing transactions that don't have invoices yet"""
    try:
        repo = FinanceRepository(db)
        count = repo.generate_invoices_from_transactions()
        return {
            "message": f"Generated {count} invoices from existing transactions",
            "count": count
        }
    except Exception as e:
        logger.exception(f"Error generating invoices: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


def _user_identifier(user):
    return getattr(user, "username_karyawan", getattr(user, "username_owner", getattr(user, "username_client", None)))


@router.get("/transaksi/harian")
def get_transaksi_by_date(tanggal: str, db: Session = Depends(get_db), current_user = require_role(["Finance", "Owner"])):
    repo = FinanceRepository(db)
    data = repo.get_transaksi_by_date(tanggal)
    return {"requested_by": _user_identifier(current_user), "tanggal": tanggal, "data": data}
 

@router.get("/laporan/keuangan")
def get_laporan_keuangan(db: Session = Depends(get_db), current_user = require_role(["Finance", "Owner"])):
    repo = FinanceRepository(db)
    return {
        "requested_by": _user_identifier(current_user),
        "transaksi": repo.get_all_transaksi(),
        "payroll": repo.get_all_payroll()
    }


@router.get("/laporan/export")
def export_laporan(start_date: str, end_date: str, db: Session = Depends(get_db), current_user = require_role(["Finance", "Owner"])):
    repo = FinanceRepository(db)
    data = repo.get_transaksi_by_range(start_date, end_date)
    return {"requested_by": _user_identifier(current_user), "start_date": start_date, "end_date": end_date, "data": data}