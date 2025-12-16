import csv
from io import StringIO
from sqlalchemy.orm import Session
from app.models.payment import Payment
from datetime import datetime

class MutasiRepository:
    def __init__(self, db: Session):
        self.db = db

    def parse_mutasi_csv(self, csv_content: str):
        # Contoh header: Tanggal,Deskripsi,Debit,Kredit,Saldo,Reference
        reader = csv.DictReader(StringIO(csv_content))
        mutasi = []
        for row in reader:
            mutasi.append({
                "tanggal": row.get("Tanggal"),
                "deskripsi": row.get("Deskripsi"),
                "debit": float(row.get("Debit", 0) or 0),
                "kredit": float(row.get("Kredit", 0) or 0),
                "saldo": float(row.get("Saldo", 0) or 0),
                "reference": row.get("Reference")
            })
        return mutasi

    def reconcile(self, mutasi_list):
        # Cocokkan mutasi dengan payment yang belum approved
        results = []
        for m in mutasi_list:
            payment = self.db.query(Payment).filter(
                Payment.jumlah == m["kredit"],
                Payment.tanggal == datetime.strptime(m["tanggal"], "%Y-%m-%d").date(),
                Payment.approval_status == "pending"
            ).first()
            results.append({
                "mutasi": m,
                "payment": payment.kd_payment if payment else None
            })
        return results
