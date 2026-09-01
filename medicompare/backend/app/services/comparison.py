"""
Builds a price comparison result for a single prescription medicine, using
only deterministic "same composition" matches from services/matching.py.
"""
from typing import Optional
from sqlalchemy.orm import Session

from app.models import Medicine, PrescriptionMedicine
from app.services.matching import find_best_catalogue_match, find_same_composition


def build_comparison(db: Session, pm: PrescriptionMedicine) -> dict:
    matched: Optional[Medicine] = None
    if pm.matched_medicine_id:
        matched = db.query(Medicine).filter(Medicine.id == pm.matched_medicine_id).first()
    if matched is None:
        matched = find_best_catalogue_match(db, pm.medicine_name, pm.strength or "")

    options = []
    prescribed_price = None
    lowest_generic = None
    lowest_jan_aushadhi = None

    if matched is None:
        return {
            "prescription_medicine_id": pm.id,
            "prescribed_name": pm.medicine_name,
            "match_status": "unmatched",
            "options": [],
            "prescribed_price": None,
            "lowest_generic_price": None,
            "lowest_jan_aushadhi_price": None,
            "potential_saving": 0.0,
        }

    prescribed_price = matched.price
    options.append({
        "type": "Prescribed",
        "medicine_id": matched.id,
        "brand": matched.brand_name,
        "salt": matched.active_ingredient,
        "strength": matched.strength,
        "manufacturer": matched.manufacturer,
        "pack_size": matched.pack_size,
        "price": matched.price,
        "source": matched.source,
    })

    alternatives = find_same_composition(db, matched)
    for alt in alternatives:
        is_generic = alt.generic_available or alt.brand_name.lower() == alt.generic_name.lower()
        opt_type = "Generic" if is_generic else "Generic"
        options.append({
            "type": opt_type,
            "medicine_id": alt.id,
            "brand": alt.brand_name,
            "salt": alt.active_ingredient,
            "strength": alt.strength,
            "manufacturer": alt.manufacturer,
            "pack_size": alt.pack_size,
            "price": alt.price,
            "source": alt.source,
        })
        if lowest_generic is None or alt.price < lowest_generic:
            lowest_generic = alt.price

        if alt.jan_aushadhi_available and alt.jan_aushadhi_price:
            options.append({
                "type": "Jan Aushadhi",
                "medicine_id": alt.id,
                "brand": alt.brand_name,
                "salt": alt.active_ingredient,
                "strength": alt.strength,
                "manufacturer": "Jan Aushadhi Kendra",
                "pack_size": alt.pack_size,
                "price": alt.jan_aushadhi_price,
                "source": "PMBJP demo reference",
            })
            if lowest_jan_aushadhi is None or alt.jan_aushadhi_price < lowest_jan_aushadhi:
                lowest_jan_aushadhi = alt.jan_aushadhi_price

    # The prescribed medicine itself might have a Jan Aushadhi price
    if matched.jan_aushadhi_available and matched.jan_aushadhi_price:
        if lowest_jan_aushadhi is None or matched.jan_aushadhi_price < lowest_jan_aushadhi:
            lowest_jan_aushadhi = matched.jan_aushadhi_price

    candidate_lows = [p for p in [lowest_generic, lowest_jan_aushadhi] if p is not None]
    lowest_overall = min(candidate_lows) if candidate_lows else prescribed_price
    potential_saving = max(0.0, round(prescribed_price - lowest_overall, 2))

    return {
        "prescription_medicine_id": pm.id,
        "prescribed_name": pm.medicine_name,
        "match_status": "matched",
        "options": options,
        "prescribed_price": prescribed_price,
        "lowest_generic_price": lowest_generic,
        "lowest_jan_aushadhi_price": lowest_jan_aushadhi,
        "potential_saving": potential_saving,
    }
