from sqlalchemy.orm import Session
from app.models.bonus import Bonus
from app.utils.bonus import calculate_sales_bonus
from decimal import Decimal
from sqlalchemy import and_
from .base_repository import BaseRepository

class BonusRepository(BaseRepository):
    """
    Bonus repository helpers. Exposes:
      - find_by_price(harga)
      - get_or_create_for_price(harga)
    """
    def __init__(self, db: Session):
        # BaseRepository expects (model, db)
        super().__init__(Bonus, db)

    def find_by_price(self, harga: float):
        if harga is None:
            return None
        
        # Just return the first tier - we'll calculate the proper percentage in the utility function
        return self.db.query(self.model).first()

    def get_or_create_for_price(self, harga: float):
        """
        Return existing Bonus matching price range or create a computed row.
        Created row will have persen/jumlah_bonus filled from util calculate_sales_bonus.
        """
        found = self.find_by_price(harga)
        if found:
            return found

        calc = calculate_sales_bonus(harga)
        pct = calc["percent"]
        amt = calc["amount"]

        new = Bonus(
            nama=f"Bonus tier for {harga:,.2f}",
            persen=float(pct) if pct is not None else None,
            jumlah_bonus=float(amt),
            deskripsi=f"Auto-generated bonus tier for price {harga:,.2f}"
        )
        self.db.add(new)
        self.db.commit()
        self.db.refresh(new)
        return new

    def seed_default_tiers(self):
        """Insert canonical tiers if not present."""
        tiers = [
            {"nama": "<300m", "persen": Decimal("0.01")},
            {"nama": "300-499m", "persen": Decimal("0.015")},
            {"nama": "500-999m", "persen": Decimal("0.02")},
            {"nama": ">=1000m", "persen": Decimal("0.025")},
        ]
        created = []
        for t in tiers:
            existing = self.get_by_percent(t["persen"])
            if not existing:
                row = Bonus(nama=t["nama"], persen=t["persen"], jumlah_bonus=None, deskripsi="Seed tier")
                self.db.add(row)
                created.append(row)
        if created:
            self.db.commit()
        return created

    def get_by_percent(self, percent: Decimal):
        return self.db.query(Bonus).filter(Bonus.persen == percent).first()