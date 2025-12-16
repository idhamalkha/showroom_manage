from app.models.invoice import Invoice
from app.models.transaksi import Transaksi
from sqlalchemy.orm import Session
from app.models.payment import Payment
from app.models.payroll import Payroll
from app.models.payroll_bulanan import PayrollBulanan
from typing import List
from datetime import date, datetime, timedelta
import logging
from app.utils.invoice import render_invoice_html, generate_pdf

logger = logging.getLogger(__name__)


class FinanceRepository:
    def create_manual_invoice(self, kd_client: int, tanggal: date, total_amount: float, due_days: int = 30):
        """Create manual invoice (not from transaksi)"""
        nomor_invoice = f"INV-MANUAL-{kd_client}-{tanggal.strftime('%Y%m%d')}-{int(datetime.now().timestamp())}"
        inv = Invoice(
            kd_transaksi=None,
            kd_client=kd_client,
            nomor_invoice=nomor_invoice,
            status="outstanding",
            total_amount=total_amount,
            paid_amount=0.0,
            tanggal_jatuh_tempo=tanggal + timedelta(days=due_days),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return inv
    def __init__(self, db: Session):
        self.db = db

    # --- Payment CRUD ---
    def create_payment(self, payment_data: dict):
        # Otomatis approve payment
        payment_data['approval_status'] = 'approved'
        payment_data['approved_at'] = datetime.now()
        p = Payment(**payment_data)
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        return p

    def list_payments(self, limit: int = 50, offset: int = 0):
        from sqlalchemy.orm import joinedload
        # Ambil semua payment, termasuk jenis 'dp' dan 'cicilan'
        return (
            self.db.query(Payment)
            .filter(Payment.jenis.in_(['cash', 'transfer', 'dp', 'cicilan']))
            .options(joinedload(Payment.client))
            .order_by(Payment.tanggal.desc(), Payment.kd_payment.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    def get_payment(self, kd_payment: int):
        return self.db.query(Payment).filter(Payment.kd_payment == kd_payment).first()

    def approve_payment(self, kd_payment: int, kd_karyawan: int):
        payment = self.db.query(Payment).filter(Payment.kd_payment == kd_payment).first()
        if not payment:
            return None
        payment.approval_status = "approved"
        payment.approved_by = kd_karyawan
        payment.approved_at = datetime.now()
        self.db.commit()
        return payment

    def reject_payment(self, kd_payment: int, kd_karyawan: int):
        payment = self.db.query(Payment).filter(Payment.kd_payment == kd_payment).first()
        if not payment:
            return None
        payment.approval_status = "rejected"
        payment.approved_by = kd_karyawan
        payment.approved_at = datetime.now()
        self.db.commit()
        return payment

    def get_pending_payments(self, limit: int = 50):
        return self.db.query(Payment).filter(Payment.approval_status == "pending").order_by(Payment.tanggal.desc()).limit(limit).all()

    def generate_invoice_pdf_for_payment(self, kd_payment: int):
        p = self.get_payment(kd_payment)
        if not p:
            return None

        t = None
        if p.kd_transaksi:
            t = self.db.query(Transaksi).filter(Transaksi.kd_transaksi == p.kd_transaksi).first()

        # Build basic invoice HTML using existing util
        try:
            client = t.client if t else None
            sales = t.sales if t else None
            details = getattr(t, 'details', []) if t else []

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
            pdf_bytes = generate_pdf(html)
            return pdf_bytes
        except Exception:
            logger.exception('Failed generating invoice PDF for payment %s', kd_payment)
            return None

    # --- Reporting helpers ---
    def get_transaksi_by_date(self, tanggal: date) -> List[Transaksi]:
        return self.db.query(Transaksi).filter_by(tanggal=tanggal).all()

    def get_all_transaksi(self) -> List[Transaksi]:
        return self.db.query(Transaksi).all()

    def get_all_payroll(self) -> List[Payroll]:
        return self.db.query(Payroll).all()

    def get_transaksi_by_range(self, start_date: date, end_date: date) -> List[Transaksi]:
        return (
            self.db.query(Transaksi)
            .filter(Transaksi.tanggal >= start_date, Transaksi.tanggal <= end_date)
            .all()
        )

    # --- Invoice Management ---
    def create_invoice_from_transaksi(self, kd_transaksi: int, due_days: int = 30):
        """Auto-create invoice from transaksi if not already exists"""
        t = self.db.query(Transaksi).filter(Transaksi.kd_transaksi == kd_transaksi).first()
        if not t:
            return None

        # Check if invoice already exists for this transaksi
        existing = self.db.query(Invoice).filter(Invoice.kd_transaksi == kd_transaksi).first()
        if existing:
            return existing

        # Create new invoice
        inv = Invoice(
            kd_transaksi=kd_transaksi,
            nomor_invoice=f"INV-{kd_transaksi:06d}",
            status="outstanding",
            total_amount=float(getattr(t, 'total', 0) or 0),
            paid_amount=0.0,
            tanggal_jatuh_tempo=date.today() + timedelta(days=due_days),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def get_outstanding_invoices(self, limit: int = 50, offset: int = 0) -> List[Invoice]:
        """Get outstanding and partially paid invoices, ordered by due date"""
        return (
            self.db.query(Invoice)
            .filter(Invoice.status.in_(["outstanding", "partial"]))
            .order_by(Invoice.tanggal_jatuh_tempo.asc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    def get_aging_report(self):
        """Calculate aging report with buckets: current, 30-60, 60-90, 90+ days overdue"""
        today = date.today()
        buckets = {
            "current": {"count": 0, "amount": 0.0},  # 0-30 days, not yet due
            "30_60": {"count": 0, "amount": 0.0},    # 30-60 days overdue
            "60_90": {"count": 0, "amount": 0.0},    # 60-90 days overdue
            "90_plus": {"count": 0, "amount": 0.0}   # 90+ days overdue
        }

        invoices = self.db.query(Invoice).filter(Invoice.status.in_(["outstanding", "partial", "overdue"])).all()

        for inv in invoices:
            if not inv.tanggal_jatuh_tempo:
                continue

            days_overdue = (today - inv.tanggal_jatuh_tempo).days
            remaining = float(inv.total_amount) - float(inv.paid_amount or 0)

            if days_overdue <= 0:
                buckets["current"]["count"] += 1
                buckets["current"]["amount"] += remaining
            elif days_overdue <= 60:
                buckets["30_60"]["count"] += 1
                buckets["30_60"]["amount"] += remaining
            elif days_overdue <= 90:
                buckets["60_90"]["count"] += 1
                buckets["60_90"]["amount"] += remaining
            else:
                buckets["90_plus"]["count"] += 1
                buckets["90_plus"]["amount"] += remaining

        return buckets

    def record_payment_to_invoice(self, kd_invoice: int, payment_data: dict):
        """Record payment against invoice and auto-update invoice status"""
        inv = self.db.query(Invoice).filter(Invoice.kd_invoice == kd_invoice).first()
        if not inv:
            return None

        # Create payment record - only set kd_invoice, kd_transaksi stays null when recording against invoice
        payment_data['kd_invoice'] = kd_invoice
        # Remove kd_transaksi if it exists to avoid conflicts
        payment_data.pop('kd_transaksi', None)

        p = Payment(**payment_data)
        self.db.add(p)
        self.db.flush()

        # Update invoice paid_amount and status
        paid_amount_increase = float(payment_data.get('jumlah', 0) or 0)
        inv.paid_amount = float(inv.paid_amount or 0) + paid_amount_increase
        inv.updated_at = datetime.now()

        # Auto-update status based on payment progress
        total = float(inv.total_amount)
        paid = float(inv.paid_amount)

        if paid >= total:
            inv.status = "paid"
        elif paid > 0:
            inv.status = "partial"
        else:
            inv.status = "outstanding"

        self.db.commit()
        self.db.refresh(inv)
        self.db.refresh(p)
        return {"payment": p, "invoice": inv}

    def get_invoice_with_payments(self, kd_invoice: int):
        """Get invoice with all related payments"""
        inv = self.db.query(Invoice).filter(Invoice.kd_invoice == kd_invoice).first()
        if not inv:
            return None

        payments = self.db.query(Payment).filter(Payment.kd_invoice == kd_invoice).order_by(Payment.tanggal.desc()).all()
        
        return {
            "invoice": inv,
            "payments": payments,
            "remaining": float(inv.total_amount) - float(inv.paid_amount or 0)
        }

    def generate_invoices_from_transactions(self):
        """Auto-generate invoices from transactions that don't have invoices yet"""
        # Get transactions without invoices
        existing_kd_transaksi = self.db.query(Invoice.kd_transaksi).distinct().all()
        existing_kd_transaksi_set = {row[0] for row in existing_kd_transaksi}
        
        transactions_without_invoices = self.db.query(Transaksi).filter(
            ~Transaksi.kd_transaksi.in_(list(existing_kd_transaksi_set))
        ).all()
        
        count = 0
        for transaksi in transactions_without_invoices:
            try:
                # Create invoice
                nomor_invoice = f"INV-{transaksi.kd_transaksi:06d}-{transaksi.tanggal.strftime('%Y%m%d')}"
                
                # Determine status and paid amount based on payment method
                metode = getattr(transaksi, 'metode_pembayaran', '').lower() if hasattr(transaksi, 'metode_pembayaran') else ''
                if metode == 'cash':
                    status = 'paid'
                    paid_amount = float(getattr(transaksi, 'total_harga', 0) or 0)
                else:
                    status = 'outstanding'
                    paid_amount = 0
                
                total_amount = float(getattr(transaksi, 'total_harga', 0) or 0)
                tanggal = getattr(transaksi, 'tanggal', date.today())
                
                invoice = Invoice(
                    kd_transaksi=transaksi.kd_transaksi,
                    nomor_invoice=nomor_invoice,
                    status=status,
                    total_amount=total_amount,
                    paid_amount=paid_amount,
                    tanggal_jatuh_tempo=tanggal + timedelta(days=30),
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                self.db.add(invoice)
                count += 1
            except Exception as e:
                logger.exception(f'Error creating invoice for transaksi {transaksi.kd_transaksi}: {e}')
                continue
        
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.exception(f'Error committing invoices: {e}')
            raise
        
        return count

    def get_cashflow_report(self, start_date: date, end_date: date):
        """Return cashflow summary (total in/out per day) for given date range"""
        try:
            from collections import defaultdict
            cashflow = defaultdict(list)

            # Get all payments (pemasukan)
            payments = self.db.query(Payment).filter(
                Payment.tanggal >= start_date,
                Payment.tanggal <= end_date,
                Payment.jenis.in_(['cash', 'transfer', 'dp', 'cicilan'])
            ).all()
            for p in payments:
                d = p.tanggal.strftime("%Y-%m-%d")
                # Use p.reference if available, otherwise use invoice nomor_invoice
                if p.reference:
                    ref = p.reference
                elif p.invoice:
                    ref = p.invoice.nomor_invoice
                else:
                    ref = "-"
                cashflow[d].append({
                    "date": d,
                    "in": float(p.jumlah or 0),
                    "out": 0.0,
                    "jenis": p.jenis,
                    "reference": ref,
                    "kd_payment": p.kd_payment
                })

            # Get all payrolls from payroll_bulanan table (new, preferred)
            # Include all statuses (draft, approved, paid) for reporting purposes
            payrolls_bulanan = self.db.query(PayrollBulanan).filter(
                PayrollBulanan.periode >= start_date, 
                PayrollBulanan.periode <= end_date
            ).all()
            
            for pr in payrolls_bulanan:
                d = pr.periode.strftime("%Y-%m-%d")
                ref = f"PAYROLL-{pr.periode.strftime('%Y-%m')}"
                total_gaji = float(pr.total_gaji or 0)
                
                # Only add if total_gaji > 0
                if total_gaji > 0:
                    cashflow[d].append({
                        "date": d,
                        "in": 0.0,
                        "out": total_gaji,
                        "jenis": "gaji",
                        "reference": ref,
                        "kd_payroll_bulanan": pr.kd_payroll_bulanan
                    })
            
            # Fallback: Get old payroll records if no payroll_bulanan exists
            if not payrolls_bulanan:
                payrolls = self.db.query(Payroll).filter(
                    Payroll.periode >= start_date, 
                    Payroll.periode <= end_date
                ).all()
                
                for pr in payrolls:
                    d = pr.periode.strftime("%Y-%m-%d")
                    ref = f"PAYROLL-{pr.periode.strftime('%Y-%m')}"
                    total_gaji = float(pr.total_gaji or 0)
                    
                    # Only add if total_gaji > 0
                    if total_gaji > 0:
                        cashflow[d].append({
                            "date": d,
                            "in": 0.0,
                            "out": total_gaji,
                            "jenis": "gaji",
                            "reference": ref,
                            "kd_payroll": pr.kd_payroll if hasattr(pr, 'kd_payroll') else None
                        })

            # Flatten and sort by date
            result = []
            for d in sorted(cashflow.keys()):
                result.extend(cashflow[d])
            return result
        except Exception as e:
            import traceback
            print("ERROR CASHFLOW:", e)
            traceback.print_exc()
            raise

    def get_sales_report(self, start_date: date, end_date: date):
        """Return sales summary (total sales per day) with transaction details for given date range"""
        from collections import defaultdict
        transaksi = self.db.query(Transaksi).filter(Transaksi.tanggal >= start_date, Transaksi.tanggal <= end_date).all()
        grouped = defaultdict(list)
        for t in transaksi:
            d = t.tanggal.strftime("%Y-%m-%d")
            grouped[d].append({
                "kd_transaksi": t.kd_transaksi,
                "total_harga": float(getattr(t, "total_harga", 0) or 0),
                "kd_client": t.kd_client,
                "nama_client": t.client.nama_client if t.client else None,
                "kd_sales": t.kd_sales,
                "nama_sales": t.sales.nama_karyawan if t.sales else None,
            })
        result = []
        for d in sorted(grouped.keys()):
            trx_list = grouped[d]
            total_sales = sum(trx["total_harga"] for trx in trx_list)
            result.append({
                "date": d,
                "total_sales": total_sales,
                "transaksi": trx_list,
                "count": len(trx_list)
            })
        return result
