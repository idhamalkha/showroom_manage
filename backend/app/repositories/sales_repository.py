from sqlalchemy import func, desc, case
from datetime import datetime, timedelta
from ..models.transaksi import Transaksi
from ..models.karyawan import Karyawan
from ..models.client import Client
from ..models.jabatan import Jabatan
from ..models.mobil import Mobil
from ..models.merek import Merek
from ..models.kelas_mobil import KelasMobil
from ..models.transaksi_detail import TransaksiDetail
from sqlalchemy.orm import Session, joinedload
import logging
logger = logging.getLogger(__name__)
from app.repositories.bonus_repository import BonusRepository
from decimal import Decimal
from .mobil_warna_repository import MobilWarnaRepository
from app.models.payroll import Payroll
from datetime import date

class SalesRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_summary(self, kd_karyawan: int = None, start_date: date = None, end_date: date = None):
        try:
            # Default to current month if no dates provided
            if start_date is None or end_date is None:
                first_day = datetime.now().replace(day=1)
                last_day_of_month = (first_day.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                start_date = start_date or first_day.date()
                end_date = end_date or last_day_of_month.date()
            
            # Get payment totals with null checks (with date range filter)
            # Normalize payment method labels (case-insensitive) and aggregate
            lp = func.lower(func.coalesce(Transaksi.metode_pembayaran, ''))
            cash_aliases = ['cash', 'tunai', 'lunas']
            credit_aliases = ['credit', 'kredit', 'cicilan', 'card', 'kredit_card']

            payment_query = (
                self.db.query(
                    func.coalesce(
                        func.sum(
                            case(
                                (lp.in_(cash_aliases), Transaksi.total_harga),
                                else_=0
                            )
                        ),
                        0
                    ).label('total_cash'),
                    func.coalesce(
                        func.sum(
                            case(
                                (lp.in_(credit_aliases), Transaksi.total_harga),
                                else_=0
                            )
                        ),
                        0
                    ).label('total_credit'),
                    func.coalesce(
                        func.sum(
                            case(
                                (~lp.in_(cash_aliases + credit_aliases), Transaksi.total_harga),
                                else_=0
                            )
                        ),
                        0
                    ).label('total_other')
                )
                .filter(Transaksi.tanggal >= start_date)
                .filter(Transaksi.tanggal <= end_date)
            )
            # Filter by kd_sales if provided
            if kd_karyawan is not None:
                payment_query = payment_query.filter(Transaksi.kd_sales == kd_karyawan)
            
            payment_totals = payment_query.first()

            # Get latest transaction with safe joins
            latest_transaction = (
                self.db.query(Transaksi)
                .outerjoin(Client)
                .filter(Transaksi.tanggal >= start_date)
                .filter(Transaksi.tanggal <= end_date)
                .order_by(desc(Transaksi.tanggal))
            )
            # Filter by kd_sales if provided
            if kd_karyawan is not None:
                latest_transaction = latest_transaction.filter(Transaksi.kd_sales == kd_karyawan)
            
            latest_transaction = latest_transaction.first()

            # Get total customers safely using the actual primary key column of Client (with date range)
            pk_col = list(Client.__table__.primary_key)[0]
            total_customers_query = (
                self.db.query(func.count(pk_col.distinct()))
                .join(Transaksi, Transaksi.kd_client == pk_col)
                .filter(Transaksi.tanggal >= start_date)
                .filter(Transaksi.tanggal <= end_date)
            )
            # Filter by kd_sales if provided
            if kd_karyawan is not None:
                total_customers_query = total_customers_query.filter(Transaksi.kd_sales == kd_karyawan)
            
            total_customers = total_customers_query.scalar() or 0

            # Get total orders safely (with date range)
            total_orders_query = (
                self.db.query(func.count(Transaksi.kd_transaksi))
                .filter(Transaksi.tanggal >= start_date)
                .filter(Transaksi.tanggal <= end_date)
            )
            # Filter by kd_sales if provided
            if kd_karyawan is not None:
                total_orders_query = total_orders_query.filter(Transaksi.kd_sales == kd_karyawan)
            
            total_orders = total_orders_query.scalar() or 0

            # Get top sales person this YEAR (for yearly ranking)
            # IMPORTANT: This should ALWAYS show company-wide top performer, NOT filtered by current user
            # Monthly metrics are filtered by user, but yearly ranking shows the best performer overall
            year_start = datetime.now().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            year_end = datetime.now().replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
            
            top_sales_query = (
                self.db.query(
                    Karyawan.nama_karyawan,
                    func.coalesce(func.sum(Transaksi.total_harga), 0).label('total_sales')
                )
                .join(Transaksi, Transaksi.kd_sales == Karyawan.kd_karyawan)
                .join(Jabatan, Karyawan.kd_jabatan == Jabatan.kd_jabatan)
                .filter(Jabatan.nama_jabatan == 'Sales')
                .filter(Transaksi.tanggal >= year_start.date())
                .filter(Transaksi.tanggal <= year_end.date())
                .group_by(Karyawan.kd_karyawan, Karyawan.nama_karyawan)
                .order_by(desc('total_sales'))
            )
            
            # NO filter by kd_karyawan here - always show company-wide top performer
            top_sales = top_sales_query.first()

            return {
                "total_cash": float(payment_totals.total_cash or 0),
                "total_credit": float(payment_totals.total_credit or 0),
                "total_customers": total_customers,
                "total_orders": total_orders,
                "latest_transaction": {
                    "kd_transaksi": latest_transaction.kd_transaksi,
                    "tanggal": latest_transaction.tanggal.isoformat() if latest_transaction else None,
                    "total_harga": float(latest_transaction.total_harga) if latest_transaction else 0,
                    "metode_pembayaran": (latest_transaction.metode_pembayaran or "unknown") if latest_transaction else None,
                    "client": {
                        "nama_client": latest_transaction.client.nama_client if latest_transaction and latest_transaction.client else "Unknown"
                    }
                } if latest_transaction else None,
                "top_sales": {
                    "nama_karyawan": top_sales[0] if top_sales else None,
                    "total_sales": float(top_sales[1]) if top_sales else 0
                } if top_sales else None
            }
        except Exception as e:
            logger.error(f"Error in get_dashboard_summary repository: {str(e)}")
            raise

    def get_recent_transactions(self, limit: int = 3, kd_sales: int = None):
        """
        Get the most recent transactions with buyer and vehicle details.
        Returns list of transactions with:
        - kd_transaksi, tanggal, total_harga
        - client: {nama_client, email}
        - vehicle: {nama_mobil, foto_url}
        - warna_foto_url: photo of selected color variant (if available)
        """
        try:
            from app.models.mobil_warna import MobilWarna
            query = (
                self.db.query(Transaksi)
                .options(
                    joinedload(Transaksi.client),
                    joinedload(Transaksi.details).joinedload(TransaksiDetail.mobil),
                    joinedload(Transaksi.details).joinedload(TransaksiDetail.warna)
                )
                .order_by(desc(Transaksi.tanggal), desc(Transaksi.kd_transaksi))
            )
            if kd_sales is not None:
                query = query.filter(Transaksi.kd_sales == kd_sales)
            recent_transaksi = query.limit(limit).all()

            result = []
            for transaksi in recent_transaksi:
                # Get primary vehicle from first detail (in case multiple vehicles per transaction)
                primary_vehicle = None
                warna_foto_url = None
                
                if transaksi.details:
                    first_detail = transaksi.details[0]
                    if first_detail.mobil:
                        primary_vehicle = {
                            "nama_mobil": first_detail.mobil.nama_mobil,
                            "foto_url": first_detail.mobil.foto_url
                        }
                    
                    # Get color variant photo if kd_warna is set (use eager-loaded relation if available)
                    if first_detail.kd_warna:
                        if getattr(first_detail, 'warna', None) and getattr(first_detail.warna, 'foto_url', None):
                            warna_foto_url = first_detail.warna.foto_url

                result.append({
                    "kd_transaksi": transaksi.kd_transaksi,
                    "tanggal": transaksi.tanggal.isoformat() if transaksi.tanggal else None,
                    "total_harga": float(transaksi.total_harga) if transaksi.total_harga else 0,
                    # normalize payment method for frontend consistency
                    "metode_pembayaran": str((transaksi.metode_pembayaran or "unknown")).lower(),
                    "client": {
                        "nama_client": transaksi.client.nama_client if transaksi.client else "Unknown",
                        "email": transaksi.client.username_client if transaksi.client else None
                    },
                    "vehicle": primary_vehicle,
                    "warna_foto_url": warna_foto_url
                })

            # debug log: show minimal identifying info to help diagnose ordering issues
            try:
                if logger.isEnabledFor(logging.DEBUG):
                    debug_list = [
                        {"kd_transaksi": t.kd_transaksi, "tanggal": getattr(t, 'tanggal', None), "metode_pembayaran": getattr(t, 'metode_pembayaran', None)}
                        for t in recent_transaksi
                    ]
                    logger.debug("recent_transactions debug: %s", debug_list)
            except Exception:
                # never fail on logging
                logger.exception("failed while logging recent transactions debug info")

            return result
        except Exception as e:
            logger.error(f"Error in get_recent_transactions repository: {str(e)}")
            raise
    def get_top_vehicles(self, limit: int = 5):
        """Get top selling vehicles by transaction count"""
        try:
            results = (
                self.db.query(
                    Mobil.nama_mobil,
                    Mobil.foto_url,
                    func.count(TransaksiDetail.kd_detail).label('sales_count'),
                    func.coalesce(func.sum(TransaksiDetail.subtotal), 0).label('total_revenue')
                )
                .join(TransaksiDetail, TransaksiDetail.kd_mobil == Mobil.kd_mobil)
                .group_by(Mobil.kd_mobil, Mobil.nama_mobil, Mobil.foto_url)
                .order_by(desc('sales_count'))
                .limit(limit)
                .all()
            )

            return [
                {
                    "nama_mobil": r.nama_mobil,
                    "foto_url": r.foto_url,
                    "sales_count": r.sales_count or 0,
                    "total_revenue": float(r.total_revenue or 0)
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"Error in get_top_vehicles: {str(e)}")
            return []

    def get_payment_methods_breakdown(self):
        """Get breakdown of payments by method"""
        try:
            results = (
                self.db.query(
                    Transaksi.metode_pembayaran,
                    func.count(Transaksi.kd_transaksi).label('count'),
                    func.coalesce(func.sum(Transaksi.total_harga), 0).label('total')
                )
                .group_by(Transaksi.metode_pembayaran)
                .all()
            )

            return [
                {
                    "metode_pembayaran": r.metode_pembayaran or "unknown",
                    "count": r.count or 0,
                    "total": float(r.total or 0)
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"Error in get_payment_methods_breakdown: {str(e)}")
            return []

    def get_daily_sales_trend(self, days: int = 7):
        """Get daily sales trend for the last N days"""
        try:
            from datetime import datetime, timedelta
            start_date = datetime.now().date() - timedelta(days=days)
            
            results = (
                self.db.query(
                    func.date(Transaksi.tanggal).label('date'),
                    func.count(Transaksi.kd_transaksi).label('transaction_count'),
                    func.coalesce(func.sum(Transaksi.total_harga), 0).label('total_amount')
                )
                .filter(Transaksi.tanggal >= start_date)
                .group_by(func.date(Transaksi.tanggal))
                .order_by(func.date(Transaksi.tanggal))
                .all()
            )

            return [
                {
                    "date": r.date.isoformat() if r.date else None,
                    "transaction_count": r.transaction_count or 0,
                    "total_amount": float(r.total_amount or 0)
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"Error in get_daily_sales_trend: {str(e)}")
            return []

    def get_conversion_rate(self):
        """Calculate conversion rate (customers who made purchase / total clients)"""
        try:
            # Total unique clients who made purchases
            purchasing_clients = (
                self.db.query(func.count(func.distinct(Transaksi.kd_client)))
                .scalar() or 0
            )
            
            # Total clients in system
            total_clients = (
                self.db.query(func.count(Client.kd_client))
                .scalar() or 0
            )
            
            conversion_rate = 0.0
            if total_clients > 0:
                conversion_rate = (purchasing_clients / total_clients) * 100

            return {
                "purchasing_clients": purchasing_clients,
                "total_clients": total_clients,
                "conversion_rate": round(conversion_rate, 2)
            }
        except Exception as e:
            logger.error(f"Error in get_conversion_rate: {str(e)}")
            return {"purchasing_clients": 0, "total_clients": 0, "conversion_rate": 0.0}
        # return list of mobil with merek and kelas info as dicts
        rows = (
            self.db.query(
                Mobil,
                Merek.kd_merek,
                Merek.nama_merek,
                Merek.logo_url,
                KelasMobil.kd_kelas,
                KelasMobil.nama.label("kelas_nama"),
                KelasMobil.deskripsi.label("kelas_deskripsi")
            )
            .outerjoin(Merek, Mobil.kd_merek == Merek.kd_merek)
            .outerjoin(KelasMobil, Mobil.kd_kelas == KelasMobil.kd_kelas)
            .all()
        )
        out = []
        for mobil, kd_merek, nama_merek, logo_url, kd_kelas, kelas_nama, kelas_deskripsi in rows:
            out.append({
                "kd_mobil": mobil.kd_mobil,
                "nama_mobil": mobil.nama_mobil,
                "kelas_mobil": mobil.kelas_mobil,
                "kd_kelas": kd_kelas,
                "kelas_nama": kelas_nama,
                "kelas_deskripsi": kelas_deskripsi,
                "harga_mobil": float(mobil.harga_mobil) if mobil.harga_mobil is not None else None,
                "kd_merek": kd_merek,
                "nama_merek": nama_merek,
                "merek_logo": logo_url,
                "foto_url": mobil.foto_url,
                "video_url": mobil.video_url,
                "status": getattr(mobil, "status", None),
                "engine_cc": mobil.engine_cc,
                "power_ps": mobil.power_ps,
                "tahun_keluaran": mobil.tahun_keluaran,
                "harga_off_road": float(mobil.harga_off_road) if getattr(mobil, "harga_off_road", None) is not None else None,
                "harga_on_road": float(mobil.harga_on_road) if getattr(mobil, "harga_on_road", None) is not None else None,
                "transmisi": getattr(mobil, "transmisi", None),
                "seats": getattr(mobil, "seats", None),
                "drivetrain": getattr(mobil, "drivetrain", None),
                "warna_tersedia": getattr(mobil, "warna_tersedia", None),
                "jenis_bahan_bakar": getattr(mobil, "jenis_bahan_bakar", None),
            })
        return out

    def get_mobil_by_merek(self, kd_merek: int):
        """Return same shape as get_all_mobil but filtered by kd_merek."""
        if kd_merek is None:
            return []
        rows = (
            self.db.query(
                Mobil,
                Merek.kd_merek,
                Merek.nama_merek,
                Merek.logo_url,
                KelasMobil.kd_kelas,
                KelasMobil.nama.label("kelas_nama"),
                KelasMobil.deskripsi.label("kelas_deskripsi")
            )
            .outerjoin(Merek, Mobil.kd_merek == Merek.kd_merek)
            .outerjoin(KelasMobil, Mobil.kd_kelas == KelasMobil.kd_kelas)
            .filter(Mobil.kd_merek == kd_merek)
            .all()
        )
        out = []
        for mobil, kd_merek, nama_merek, logo_url, kd_kelas, kelas_nama, kelas_deskripsi in rows:
            out.append({
                "kd_mobil": mobil.kd_mobil,
                "nama_mobil": mobil.nama_mobil,
                "kelas_mobil": mobil.kelas_mobil,
                "kd_kelas": kd_kelas,
                "kelas_nama": kelas_nama,
                "kelas_deskripsi": kelas_deskripsi,
                "harga_mobil": float(mobil.harga_mobil) if mobil.harga_mobil is not None else None,
                "kd_merek": kd_merek,
                "nama_merek": nama_merek,
                "merek_logo": logo_url,
                "foto_url": mobil.foto_url,
                "video_url": mobil.video_url,
                "status": getattr(mobil, "status", None),
                "engine_cc": mobil.engine_cc,
                "power_ps": mobil.power_ps,
                "tahun_keluaran": mobil.tahun_keluaran,
                "harga_off_road": float(mobil.harga_off_road) if getattr(mobil, "harga_off_road", None) is not None else None,
                "harga_on_road": float(mobil.harga_on_road) if getattr(mobil, "harga_on_road", None) is not None else None,
                "transmisi": getattr(mobil, "transmisi", None),
                "seats": getattr(mobil, "seats", None),
                "drivetrain": getattr(mobil, "drivetrain", None),
                "warna_tersedia": getattr(mobil, "warna_tersedia", None),
                "jenis_bahan_bakar": getattr(mobil, "jenis_bahan_bakar", None),
            })
        return out

    def create_mobil(self, mobil_data):
        """
        Create Mobil record and ensure kd_bonus is set.
        mobil_data can be a Pydantic model (has .dict()) or a plain dict-like object.
        If kd_bonus is not provided, compute/get tier via BonusRepository and attach kd_bonus.
        """
        # determine kd_bonus (compute if missing)
        kd_bonus = getattr(mobil_data, "kd_bonus", None)
        if kd_bonus is None:
            harga = getattr(mobil_data, "harga_mobil", None) or 0
            bonus_repo = BonusRepository(self.db)
            bonus_row = bonus_repo.get_or_create_for_price(harga)
            kd_bonus = int(bonus_row.kd_bonus)

        # prepare payload dict
        if hasattr(mobil_data, "dict"):
            payload = mobil_data.dict()
        else:
            payload = dict(mobil_data)

        # attach computed kd_bonus
        payload["kd_bonus"] = kd_bonus

        # whitelist only columns that exist on Mobil.__table__ to avoid unexpected keys
        valid_cols = set(Mobil.__table__.columns.keys())
        filtered = {k: v for k, v in payload.items() if k in valid_cols}

        # coerce Pydantic HttpUrl / AnyUrl (and similar) to plain string for DB insert
        for url_field in ("foto_url", "video_url"):
            if url_field in filtered and filtered[url_field] is not None:
                try:
                    filtered[url_field] = str(filtered[url_field])
                except Exception:
                    # keep original if str() fails (will be caught by DB)
                    pass

        try:
             obj = Mobil(**filtered)
             self.db.add(obj)
             self.db.commit()
             self.db.refresh(obj)

             # handle nested warna_list if provided in the original payload
             try:
                 warna_list = payload.get('warna_list')
                 if warna_list and isinstance(warna_list, list):
                     warna_repo = MobilWarnaRepository(self.db)
                     for w in warna_list:
                         # accept dict with keys matching MobilWarnaCreate
                         try:
                             warna_repo.create(obj.kd_mobil, w or {})
                         except Exception:
                             logger.exception('failed to create mobil warna for kd_mobil=%s', obj.kd_mobil)
             except Exception:
                 # non-fatal: log and continue
                 logger.exception('failed processing nested warna_list during create_mobil')

             return obj
        except Exception as e:
             # rollback and log full traceback for debugging
             self.db.rollback()
             logger.exception("create_mobil failed (filtered payload keys: %s)", list(filtered.keys()))
             raise

    def update_mobil(self, kd_mobil: int, patch: dict):
        logger.debug("update_mobil called with kd_mobil=%s patch_keys=%s", kd_mobil, list(patch.keys()))
        # prepare patch dict (accept Pydantic model or plain dict)
        data = patch.dict() if hasattr(patch, "dict") else dict(patch or {})

        # Separate warna_list from mobil columns so we can sync color table separately
        warna_list = data.pop('warna_list', None)
        # whitelist columns present on Mobil table
        valid_cols = set(Mobil.__table__.columns.keys())
        filtered = {k: v for k, v in data.items() if k in valid_cols}

        # coerce HttpUrl/AnyUrl to plain string for foto/video fields
        for url_field in ("foto_url", "video_url"):
            if url_field in filtered and filtered[url_field] is not None:
                try:
                    filtered[url_field] = str(filtered[url_field])
                except Exception:
                    pass

        obj = self.db.query(Mobil).filter(Mobil.kd_mobil == kd_mobil).first()
        if not obj:
            raise ValueError("mobil not found")

        for k, v in filtered.items():
            setattr(obj, k, v)

        try:
            self.db.commit()
            self.db.refresh(obj)

            # after updating mobil row, sync warna_list if provided
            if warna_list is not None:
                try:
                    warna_repo = MobilWarnaRepository(self.db)
                    existing = {w.kd_warna: w for w in warna_repo.list_by_mobil(kd_mobil)}

                    incoming_by_id = {w.get('kd_warna'): w for w in (warna_list or []) if w.get('kd_warna')}

                    # create new entries (no kd_warna)
                    for w in (warna_list or []):
                        if not w.get('kd_warna'):
                            try:
                                warna_repo.create(kd_mobil, w or {})
                            except Exception:
                                logger.exception('failed to create mobil warna during update_mobil kd_mobil=%s', kd_mobil)

                    # update existing
                    for w in (warna_list or []):
                        if w.get('kd_warna'):
                            try:
                                warna_repo.update(w.get('kd_warna'), {k: v for k, v in w.items() if k != 'kd_warna'})
                            except Exception:
                                logger.exception('failed to update mobil warna kd_warna=%s', w.get('kd_warna'))

                    # delete removed: existing ids not present in incoming
                    incoming_ids = {w.get('kd_warna') for w in (warna_list or []) if w.get('kd_warna')}
                    for ex_id in existing.keys():
                        if ex_id not in incoming_ids:
                            try:
                                warna_repo.delete(ex_id)
                            except Exception:
                                logger.exception('failed to delete mobil warna kd_warna=%s', ex_id)

                    # refresh object relationships if needed
                    self.db.refresh(obj)
                except Exception:
                    logger.exception('failed syncing warna_list in update_mobil for kd_mobil=%s', kd_mobil)

            return obj
        except Exception:
            self.db.rollback()
            logger.exception("update_mobil failed (filtered keys: %s)", list(filtered.keys()))
            raise

    def delete_mobil(self, kd_mobil: int):
        m = self.db.query(Mobil).filter_by(kd_mobil=kd_mobil).first()
        if not m:
            raise ValueError("Mobil not found")
        self.db.delete(m)
        self.db.commit()
        return True

    def add_bonus_to_payroll(self, kd_karyawan: int, harga: float, kd_bonus: int | None = None, periode: date | None = None):
        """
        Compute bonus for a sale `harga` and add it to the Payroll row for `kd_karyawan` and `periode`.
        If `kd_bonus` is provided, use the corresponding Bonus tier; else fallback to bonus_repo.find_by_price
        or the util `calculate_sales_bonus`.

        This function will create a Payroll row for the periode if one doesn't exist.
        Returns a dict with percent and amount (Decimal).
        """
        if harga is None:
            return {"percent": Decimal("0.0"), "amount": Decimal("0.0")}

        # ensure periode is a date (default to today)
        if periode is None:
            periode = date.today()

        bonus_repo = BonusRepository(self.db)
        bm = None
        # 1) use explicit kd_bonus if provided
        if kd_bonus:
            bm = self.db.query(bonus_repo.model).filter_by(kd_bonus=kd_bonus).first()
        # 2) fallback: find by price
        if not bm:
            bm = bonus_repo.find_by_price(harga)

        if bm and getattr(bm, "persen", None) is not None:
            pct = Decimal(str(bm.persen))
            amount = (Decimal(str(harga)) * pct).quantize(Decimal("1.00"))
        else:
            # fallback to util
            from app.utils.bonus import calculate_sales_bonus
            calc = calculate_sales_bonus(harga)
            pct = calc["percent"]
            amount = calc["amount"]

        # if no kd_karyawan provided, don't persist payroll (but return computed values)
        if not kd_karyawan:
            return {"percent": pct, "amount": amount}

        # look up payroll for kd_karyawan and periode
        try:
            pw = (
                self.db.query(Payroll)
                .filter(Payroll.kd_karyawan == kd_karyawan)
                .filter(Payroll.periode == periode)
                .first()
            )

            if not pw:
                # create a new payroll row with this bonus
                new_pw = Payroll(
                    kd_karyawan=kd_karyawan,
                    gaji_pokok=Decimal("0.00"),
                    bonus=amount,
                    lembur=Decimal("0.00"),
                    potongan=Decimal("0.00"),
                    total_gaji=amount,
                    periode=periode,
                )
                self.db.add(new_pw)
                self.db.commit()
                self.db.refresh(new_pw)
            else:
                # update existing payroll: add bonus and update total_gaji
                existing_bonus = Decimal(str(getattr(pw, "bonus", 0) or 0))
                existing_total = Decimal(str(getattr(pw, "total_gaji", 0) or 0))
                pw.bonus = (existing_bonus + amount).quantize(Decimal("1.00"))
                pw.total_gaji = (existing_total + amount).quantize(Decimal("1.00"))
                self.db.add(pw)
                self.db.commit()
                self.db.refresh(pw)
        except Exception:
            # do not raise to avoid failing the transaction flow; just log
            logger.exception("failed to persist bonus into payroll for kd_karyawan=%s periode=%s", kd_karyawan, periode)

        return {"percent": pct, "amount": amount}

    def create_transaksi(self, transaksi_data: dict, details: list[dict]):
        """
        Create a Transaksi and its details.
        transaksi_data: Dict containing header data
        details: List of dicts containing detail data
        Returns the created Transaksi with populated details
        """
        try:
            # Compute total from details
            total = sum(float(d.get('subtotal', 0) or 0) for d in details)
            
            # Create Transaksi instance with computed total
            transaksi_data['total_harga'] = total
            transaksi_obj = Transaksi(**transaksi_data)
            
            # Save header
            self.db.add(transaksi_obj)
            self.db.commit()
            self.db.refresh(transaksi_obj)

            # Create and save details
            created_details = []
            for detail_data in details:
                detail = TransaksiDetail(
                    kd_transaksi=transaksi_obj.kd_transaksi,
                    **detail_data
                )
                self.db.add(detail)
                created_details.append(detail)

            self.db.commit()
            for detail in created_details:
                self.db.refresh(detail)

            # Attach details to transaksi
            transaksi_obj.details = created_details
            self.db.refresh(transaksi_obj)
            
            # --- AUTO CREATE INVOICE ---
            from app.models.invoice import Invoice
            from app.models.payment import Payment
            from datetime import datetime, timedelta
            nomor_invoice = f"INV-{transaksi_obj.kd_transaksi:06d}-{transaksi_obj.tanggal.strftime('%Y%m%d')}"
            metode = getattr(transaksi_obj, 'metode_pembayaran', '').lower() if hasattr(transaksi_obj, 'metode_pembayaran') else ''
            if metode == 'cash':
                status = 'paid'
                paid_amount = float(getattr(transaksi_obj, 'total_harga', 0) or 0)
            else:
                status = 'outstanding'
                paid_amount = 0
            total_amount = float(getattr(transaksi_obj, 'total_harga', 0) or 0)
            tanggal = getattr(transaksi_obj, 'tanggal', datetime.today().date())
            invoice = Invoice(
                kd_transaksi=transaksi_obj.kd_transaksi,
                nomor_invoice=nomor_invoice,
                status=status,
                total_amount=total_amount,
                paid_amount=paid_amount,
                tanggal_jatuh_tempo=tanggal + timedelta(days=30),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            self.db.add(invoice)
            self.db.commit()
            self.db.refresh(invoice)
            # --- END AUTO CREATE INVOICE ---

            # --- AUTO INSERT PAYMENT FOR CASH/DP/CICILAN ---
            if metode == 'cash':
                payment = Payment(
                    kd_invoice=invoice.kd_invoice,
                    kd_transaksi=transaksi_obj.kd_transaksi,
                    kd_client=transaksi_obj.kd_client,
                    jumlah=total_amount,
                    jenis='cash',
                    tanggal=tanggal,
                    status='completed',
                    reference=nomor_invoice,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                self.db.add(payment)
                self.db.commit()
                self.db.refresh(payment)
            elif metode == 'cicilan':
                # Buat faktur DP jika ada DP
                if hasattr(transaksi_obj, 'dp') and transaksi_obj.dp:
                    dp_obj = transaksi_obj.dp
                    nomor_invoice_dp = f"INV-DP-{transaksi_obj.kd_transaksi:06d}-{getattr(dp_obj, 'tanggal', tanggal).strftime('%Y%m%d')}"
                    from app.models.invoice import Invoice
                    invoice_dp = Invoice(
                        kd_transaksi=transaksi_obj.kd_transaksi,
                        nomor_invoice=nomor_invoice_dp,
                        status='paid',
                        total_amount=float(getattr(dp_obj, 'jumlah', 0) or 0),
                        paid_amount=float(getattr(dp_obj, 'jumlah', 0) or 0),
                        tanggal_jatuh_tempo=getattr(dp_obj, 'tanggal', tanggal),
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    self.db.add(invoice_dp)
                    self.db.commit()
                    self.db.refresh(invoice_dp)
                    payment_dp = Payment(
                        kd_invoice=invoice_dp.kd_invoice,
                        kd_transaksi=transaksi_obj.kd_transaksi,
                        kd_client=transaksi_obj.kd_client,
                        jumlah=float(getattr(dp_obj, 'jumlah', 0) or 0),
                        jenis='dp',
                        tanggal=getattr(dp_obj, 'tanggal', tanggal),
                        status='completed',
                        reference=nomor_invoice_dp,
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    self.db.add(payment_dp)
                    self.db.commit()
                    self.db.refresh(payment_dp)
                # Buat faktur dan payment untuk setiap cicilan
                if hasattr(transaksi_obj, 'cicilan') and transaksi_obj.cicilan:
                    for cicilan_obj in transaksi_obj.cicilan:
                        nomor_invoice_cicilan = f"INV-CICILAN-{transaksi_obj.kd_transaksi:06d}-{getattr(cicilan_obj, 'tgl_jatuh_tempo', tanggal).strftime('%Y%m%d')}"
                        from app.models.invoice import Invoice
                        invoice_cicilan = Invoice(
                            kd_transaksi=transaksi_obj.kd_transaksi,
                            nomor_invoice=nomor_invoice_cicilan,
                            status='outstanding',
                            total_amount=float(getattr(cicilan_obj, 'jumlah_cicilan', 0) or 0),
                            paid_amount=0.0,
                            tanggal_jatuh_tempo=getattr(cicilan_obj, 'tgl_jatuh_tempo', tanggal),
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        self.db.add(invoice_cicilan)
                        self.db.commit()
                        self.db.refresh(invoice_cicilan)
                        payment_cicilan = Payment(
                            kd_invoice=invoice_cicilan.kd_invoice,
                            kd_transaksi=transaksi_obj.kd_transaksi,
                            kd_client=transaksi_obj.kd_client,
                            jumlah=float(getattr(cicilan_obj, 'jumlah_cicilan', 0) or 0),
                            jenis='cicilan',
                            tanggal=getattr(cicilan_obj, 'tgl_jatuh_tempo', tanggal),
                            status='pending',
                            reference=nomor_invoice_cicilan,
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        self.db.add(payment_cicilan)
                        self.db.commit()
                        self.db.refresh(payment_cicilan)
            # --- END AUTO INSERT PAYMENT FOR CASH/DP/CICILAN ---

            return transaksi_obj

        except Exception as e:
            self.db.rollback()
            logger.exception('create_transaksi failed')
            raise

    def get_transaksi_by_id(self, kd_transaksi: int):
        """Get transaction by ID with all related data"""
        return (self.db.query(Transaksi)
                .options(
                    joinedload(Transaksi.client),
                    joinedload(Transaksi.sales),
                    joinedload(Transaksi.details).joinedload(TransaksiDetail.mobil)
                )
                .filter(Transaksi.kd_transaksi == kd_transaksi)
                .first())