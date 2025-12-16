"""
Run from project root:
python -m app.scripts.seed_bonus
(or python backend/app/scripts/seed_bonus.py depending on your layout)
"""
from app.database.connection import SessionLocal
from app.repositories.bonus_repository import BonusRepository

def main():
    db = SessionLocal()
    try:
        repo = BonusRepository(db)
        created = repo.seed_default_tiers()
        print("Seeded bonus tiers:", [r.nama for r in created] if created else "already present")
    finally:
        db.close()

if __name__ == "__main__":
    main()