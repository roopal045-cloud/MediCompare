"""
Seeds the medicine catalogue from data/medicines.json.
Run with:  python seed.py
Safe to re-run — it clears and repopulates the medicines table only.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import Base, engine, SessionLocal  # noqa: E402
from app.models import Medicine  # noqa: E402

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "medicines.json")


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Medicine).count()
        if existing > 0:
            print(f"Clearing {existing} existing medicine records...")
            db.query(Medicine).delete()
            db.commit()

        with open(DATA_PATH, "r", encoding="utf-8") as f:
            records = json.load(f)

        for record in records:
            db.add(Medicine(**record))
        db.commit()
        print(f"Seeded {len(records)} medicine records into the catalogue.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
