from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from app.models.karyawan import Karyawan
from app.models.lembur_histori import LemburHistori
from app.models.cuti_histori import CutiHistori
from app.models.payroll import Payroll
from app.models.target_sales import TargetSales
from app.models.absensi_histori import AbsensiHistori
from app.models.konfigurasi_absensi import KonfigurasiAbsensi
from app.utils import security  # assume you have hash_password
from datetime import datetime
from sqlalchemy import inspect
from sqlalchemy import func, and_
try:
    # models used for sales aggregation (may exist in your project)
    from app.models.transaksi import Transaksi
    from app.models.transaksi_detail import TransaksiDetail
except Exception:
    Transaksi = None
    TransaksiDetail = None

class HRDRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_karyawan(self) -> List[Karyawan]:
        """
        Return all karyawan rows. You can later add pagination / filters here.
        """
        return self.db.query(Karyawan).order_by(Karyawan.kd_karyawan).all()

    def get_karyawan_by_id(self, kd_karyawan: int) -> Optional[Karyawan]:
        return self.db.query(Karyawan).filter(Karyawan.kd_karyawan == kd_karyawan).first()

    def create_karyawan_with_credentials(self, payload: dict) -> dict:
        """
        payload: keys compatible with Karyawan model (includes tgl_masuk and tgl_lahir if available)
        Returns dict { karyawan: Karyawan, generated: {username, password_plain} }
        """
        # construct model instance (avoid username/hashed_password in payload)
        k = Karyawan(**{k: v for k, v in payload.items() if k not in ("username_karyawan", "hashed_password")})
        try:
            self.db.add(k)
            self.db.commit()
            self.db.refresh(k)

            # compute username: use first name from nama_karyawan (sanitized)
            raw_name = getattr(k, "nama_karyawan", "") or ""
            first = str(raw_name).strip().split()[0] if str(raw_name).strip() else f"user{k.kd_karyawan}"
            # sanitize: keep alphanum and underscore, lower-case, limit length
            import re
            base = re.sub(r'[^a-zA-Z0-9_]', '', first).lower()[:20] or f"user{k.kd_karyawan}"
            username = base
            # ensure uniqueness: append number suffix if exists
            idx = 0
            while self.db.query(Karyawan).filter(Karyawan.username_karyawan == username).first():
                idx += 1
                username = f"{base}{idx}"

            # compute plain password from tgl_lahir as DDMMYY, fallback random 8 chars
            if getattr(k, "tgl_lahir", None):
                p = k.tgl_lahir.strftime("%d%m%y")
            else:
                import secrets, string
                p = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

            # hashed password via project's security helper
            try:
                hashed = security.hash_password(p)
            except Exception:
                # fallback naive hashing if helper missing (NOT RECOMMENDED for prod)
                import hashlib
                hashed = hashlib.sha256(p.encode()).hexdigest()

            # update record with username and hashed password
            k.username_karyawan = username
            k.hashed_password = hashed
            self.db.add(k)
            self.db.commit()
            self.db.refresh(k)

            return {"karyawan": k, "generated": {"username": username, "password": p}}
        except Exception:
            self.db.rollback()
            raise

    # Karyawan CRUD
    def get_all_karyawan(self) -> List[Karyawan]:
        return self.db.query(Karyawan).all()

    def get_karyawan_by_divisi(self, kd_jabatan: int) -> List[Karyawan]:
        return self.db.query(Karyawan).filter_by(kd_jabatan=kd_jabatan).all()

    def get_karyawan_detail(self, kd_karyawan: int) -> Optional[Karyawan]:
        return self.db.query(Karyawan).filter_by(kd_karyawan=kd_karyawan).first()

    def create_karyawan(self, karyawan: Karyawan) -> Karyawan:
        try:
            self.db.add(karyawan)
            self.db.commit()
            self.db.refresh(karyawan)
            return karyawan
        except Exception:
            self.db.rollback()
            raise

    def update_karyawan(self, kd_karyawan: int, data: dict) -> Optional[Karyawan]:
        karyawan = self.get_karyawan_by_id(kd_karyawan)
        if not karyawan:
            return None

        # only allow updating actual table columns (prevents assigning ints to relationship props)
        mapper = inspect(karyawan.__class__)
        column_names = {c.key for c in mapper.columns}

        for key, val in data.items():
            if key in column_names:
                setattr(karyawan, key, val)
            else:
                # ignore unknown keys or relationship names — log/skip
                continue

        try:
            self.db.add(karyawan)
            self.db.commit()
            self.db.refresh(karyawan)
            return karyawan
        except Exception:
            self.db.rollback()
            raise

    def delete_karyawan(self, kd_karyawan: int) -> bool:
        karyawan = self.db.query(Karyawan).filter_by(kd_karyawan=kd_karyawan).first()
        if not karyawan:
            return False
        try:
            self.db.delete(karyawan)
            self.db.commit()
            return True
        except Exception:
            self.db.rollback()
            raise

    # KPI & Ranking (basic implementations)
    def get_kpi_grid(self) -> dict:
        """
        Return KPI payload used by frontend /hrd/kinerja:
        {
          top: [ { kd_karyawan, nama_karyawan, foto, nama_jabatan, sold } ],
          all: [ { kd_karyawan, nama_karyawan, foto, nama_jabatan, bonus, lembur, cuti, target_unit, target_nominal, raw... } ],
          totals: { bonus, lembur, cuti, target_nominal }
        }
        Only non-owner employees are included in `all`. Top is limited to sales-role employees.
        """
        # load jabatan relation so we can return nama_jabatan directly
        rows = (
            self.db.query(Karyawan)
            .options(selectinload(Karyawan.jabatan))
            .order_by(Karyawan.kd_karyawan)
            .all()
        )

        all_list = []
        totals = {"bonus": 0.0, "lembur": 0.0, "cuti": 0.0, "target_nominal": 0.0}

        # helper to sum attribute from list of model instances safely
        def safe_sum(query_list, *attr_names):
            s = 0.0
            for item in query_list:
                for a in attr_names:
                    if hasattr(item, a):
                        try:
                            v = getattr(item, a)
                            if v is None:
                                continue
                            s += float(v)
                            break
                        except Exception:
                            continue
            return s

        for r in rows:
            # skip Owner role in `all`
            # prefer relation object (r.jabatan), but also keep kd_jabatan
            kd_jabatan = getattr(r, "kd_jabatan", None) or getattr(getattr(r, "jabatan", None), "kd_jabatan", None)
            nama_jabatan = getattr(getattr(r, "jabatan", None), "nama_jabatan", None) or ""
            if str(nama_jabatan).strip().lower() == "owner":
                continue

            # gather payroll rows for current month
            current_month = datetime.now()
            payroll_rows = (
                self.db.query(Payroll)
                .filter(
                    Payroll.kd_karyawan == r.kd_karyawan,
                    func.extract('month', Payroll.periode) == current_month.month,
                    func.extract('year', Payroll.periode) == current_month.year
                )
                .all()
            )
            lembur_sum = safe_sum(payroll_rows, "lembur", "jumlah_lembur")
            bonus_sum = safe_sum(payroll_rows, "bonus", "jumlah_bonus")
            # try to obtain base salary (may be stored on payroll rows or on karyawan model)
            salary_sum = safe_sum(payroll_rows, "gaji", "jumlah_gaji", "gaji_pokok")
            if not salary_sum:
                # fallback to attributes on Karyawan model if present
                for attr in ("jumlah_gaji", "gaji", "gaji_pokok", "gaji_pokok_id"):
                    if hasattr(r, attr):
                        try:
                            salary_sum = float(getattr(r, attr) or 0)
                            break
                        except Exception:
                            continue

            # cuti history sum for current month - ONLY APPROVED STATUS
            cuti_rows = (
                self.db.query(CutiHistori)
                .filter(
                    CutiHistori.kd_karyawan == r.kd_karyawan,
                    CutiHistori.status == 'approved',  # Only count approved cuti
                    func.extract('month', CutiHistori.tgl_mulai) == current_month.month,
                    func.extract('year', CutiHistori.tgl_mulai) == current_month.year
                )
                .all()
            )
            cuti_sum = safe_sum(cuti_rows, "durasi_hari")

            # Attendance data for current month
            hadir_count = 0
            absen_count = 0
            potongan_absen = 0.0
            try:
                hadir_count = self.db.query(func.count(AbsensiHistori.kd_absensi)).filter(
                    and_(
                        AbsensiHistori.kd_karyawan == r.kd_karyawan,
                        AbsensiHistori.status == 'hadir',
                        func.extract('month', AbsensiHistori.tgl_absensi) == current_month.month,
                        func.extract('year', AbsensiHistori.tgl_absensi) == current_month.year
                    )
                ).scalar() or 0
                hadir_count = int(hadir_count)
                
                absen_count = self.db.query(func.count(AbsensiHistori.kd_absensi)).filter(
                    and_(
                        AbsensiHistori.kd_karyawan == r.kd_karyawan,
                        AbsensiHistori.status == 'absen',
                        func.extract('month', AbsensiHistori.tgl_absensi) == current_month.month,
                        func.extract('year', AbsensiHistori.tgl_absensi) == current_month.year
                    )
                ).scalar() or 0
                absen_count = int(absen_count)
                
                # Calculate absence deduction
                if absen_count > 0 and salary_sum > 0:
                    config = self.db.query(KonfigurasiAbsensi).filter(
                        and_(
                            KonfigurasiAbsensi.jenis_absensi == 'absen',
                            KonfigurasiAbsensi.is_active == True
                        )
                    ).first()
                    
                    if config:
                        if config.potongan_persen > 0:
                            deduction_per_day = (salary_sum * config.potongan_persen) / 100
                            potongan_absen = float(deduction_per_day * absen_count)
                        else:
                            potongan_absen = float(config.potongan_nominal * absen_count)
            except Exception as e:
                print(f"Error getting attendance data for {r.kd_karyawan}: {e}")
                pass

            # target sales (latest or sum)
            target_rows = self.db.query(TargetSales).filter_by(kd_karyawan=r.kd_karyawan).all()
            target_unit_sum = safe_sum(target_rows, "target_unit", "unit")
            target_nominal_sum = safe_sum(target_rows, "target_nominal", "nominal")

            # count transactions for sales role (by current month)
            transaksi_count = 0
            if Transaksi is not None and str(nama_jabatan).lower() == "sales":
                try:
                    q = (
                        self.db.query(func.count(Transaksi.kd_transaksi))
                        .filter(Transaksi.kd_sales == r.kd_karyawan)
                        .filter(func.extract('month', Transaksi.tanggal) == current_month.month)
                        .filter(func.extract('year', Transaksi.tanggal) == current_month.year)
                        .scalar()
                    )
                    transaksi_count = int(q or 0)
                except Exception as e:
                    print(f"Error counting transaksi for {r.kd_karyawan}: {e}")
                    pass

            totals["bonus"] += bonus_sum
            totals["lembur"] += lembur_sum 
            totals["gaji"] = totals.get("gaji", 0.0) + salary_sum
            totals["cuti"] += cuti_sum
            totals["target_nominal"] += target_nominal_sum

            all_list.append({
                "kd_karyawan": r.kd_karyawan,
                "nama_karyawan": r.nama_karyawan,
                "foto": getattr(r, "foto", None),
                "kd_jabatan": kd_jabatan,
                "nama_jabatan": nama_jabatan,
                "jumlah_gaji": salary_sum,
                "kd_kontrak": getattr(r, "kd_kontrak", None) or getattr(getattr(r, 'kontrak', None), 'kd_kontrak', None),
                "masa_kontrak": getattr(r, "masa_kontrak", None) or getattr(getattr(r, 'kontrak', None), 'masa_kontrak', None),
                "bonus": bonus_sum,
                "lembur": lembur_sum,
                "cuti": cuti_sum,
                "hadir_count": hadir_count,
                "absen_count": absen_count,
                "potongan_absen": potongan_absen,
                "target_unit": target_unit_sum,
                "target_nominal": target_nominal_sum,
                "transaksi_count": transaksi_count,  # new field for monthly transaction count
                "raw": r,
            })

        # compute top sales (prefer transaksi join when models exist, else fallback)
        top_list = []
        try:
            sold_counts = {}
            if Transaksi is not None and TransaksiDetail is not None:
                q = (
                    self.db.query(Transaksi.kd_sales, func.coalesce(func.sum(TransaksiDetail.jumlah), 0).label("sold"))
                    .join(TransaksiDetail, Transaksi.kd_transaksi == TransaksiDetail.kd_transaksi)
                    .group_by(Transaksi.kd_sales)
                    .all()
                )
                for kd_sales, sold in q:
                    sold_counts[kd_sales] = int(sold or 0)
            # fallback: try to use TargetSales or raw field 'sales_total' if present in raw object
            if not sold_counts:
                # try to use TargetSales as proxy (not ideal but fallback)
                q2 = self.db.query(TargetSales.kd_karyawan, func.coalesce(func.sum(TargetSales.target_unit), 0).label("units")).group_by(TargetSales.kd_karyawan).all()
                for kd_karyawan, units in q2:
                    sold_counts[kd_karyawan] = int(units or 0)

            # map sold_counts into employees who are Sales
            # build a lookup of meta rows by kd_karyawan
            meta_by_id = {int(item["kd_karyawan"]): item for item in all_list}
            # include employees that may appear in sold_counts but were filtered from all_list (owner excluded)
            for kd, sold in sold_counts.items():
                kd_int = int(kd)
                # include only if employee exists and has sales role
                candidate = self.db.query(Karyawan).filter_by(kd_karyawan=kd_int).first()
                nama_jabatan = getattr(getattr(candidate, "jabatan", None), "nama_jabatan", "") if candidate else ""
                if not candidate:
                    continue
                if "sales" not in str(nama_jabatan).lower():
                    continue
                top_list.append({
                    "kd_karyawan": kd_int,
                    "nama_karyawan": getattr(candidate, "nama_karyawan", None),
                    "foto": getattr(candidate, "foto", None),
                    "nama_jabatan": nama_jabatan,
                    "sold": int(sold or 0)
                })

            # if still empty, try inspect all_list for sales_total field
            if not top_list:
                for item in all_list:
                    raw = item.get("raw")
                    sales_val = None
                    if raw is not None:
                        for possible in ("sales_total", "sales", "sold"):
                            if hasattr(raw, possible):
                                try:
                                    sales_val = int(getattr(raw, possible) or 0)
                                    break
                                except Exception:
                                    continue
                    if sales_val is not None and "sales" in str(item.get("nama_jabatan", "")).lower():
                        top_list.append({
                            "kd_karyawan": item["kd_karyawan"],
                            "nama_karyawan": item["nama_karyawan"],
                            "foto": item.get("foto"),
                            "nama_jabatan": item.get("nama_jabatan"),
                            "sold": sales_val
                        })

            # sort and limit 3
            top_list.sort(key=lambda x: x.get("sold", 0), reverse=True)
            top_list = top_list[:3]
        except Exception:
            top_list = []

        return {"top": top_list, "all": all_list, "totals": totals}