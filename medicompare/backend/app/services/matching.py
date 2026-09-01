"""
Deterministic medicine matching.

The rule (per product spec) is strict and NOT decided by an LLM:
  same active ingredient + same strength + same dosage form  =>  "Same Composition"

This module is responsible for:
  1. Finding the best catalogue match for a raw prescription line
     (fuzzy brand-name match, so OCR noise like "Pantop-40" still resolves).
  2. Finding every "same composition" alternative for a matched medicine.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Medicine
from app.services.normalization import normalize_compact, normalize_token, extract_strength_mg


def find_best_catalogue_match(db: Session, medicine_name: str, strength: str = "") -> Optional[Medicine]:
    """Fuzzy-match a raw OCR'd brand name against the catalogue by brand name,
    then narrow by strength if more than one candidate remains."""
    if not medicine_name:
        return None

    target_compact = normalize_compact(medicine_name)
    target_strength = extract_strength_mg(strength or medicine_name)

    candidates: List[Medicine] = db.query(Medicine).all()
    scored = []
    for med in candidates:
        brand_compact = normalize_compact(med.brand_name)
        # Compact-string containment catches "Pantop 40" vs "Pantop40" vs "Pantop-40"
        if brand_compact in target_compact or target_compact in brand_compact:
            score = 2
            if target_strength and extract_strength_mg(med.strength) == target_strength:
                score += 1
            scored.append((score, med))
        else:
            # fall back to first-token match, e.g. "Pantop" matching "Pantop 40"
            brand_first = normalize_token(med.brand_name).split(" ")[0]
            target_first = normalize_token(medicine_name).split(" ")[0]
            if brand_first and brand_first == target_first:
                score = 1
                if target_strength and extract_strength_mg(med.strength) == target_strength:
                    score += 1
                scored.append((score, med))

    if not scored:
        return None
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1]


def find_same_composition(db: Session, medicine: Medicine) -> List[Medicine]:
    """Every catalogue entry with the same active ingredient + strength + dosage
    form, excluding the medicine itself. This is the ONLY basis for showing
    something as a comparable option."""
    ingredient_key = normalize_token(medicine.active_ingredient)
    strength_key = extract_strength_mg(medicine.strength)
    form_key = normalize_token(medicine.dosage_form)

    all_meds = db.query(Medicine).filter(Medicine.id != medicine.id).all()
    matches = [
        med for med in all_meds
        if normalize_token(med.active_ingredient) == ingredient_key
        and extract_strength_mg(med.strength) == strength_key
        and normalize_token(med.dosage_form) == form_key
    ]
    return matches
