"""
Normalization helpers for medicine names/salts so that OCR noise like
"Pantop 40", "Pantop-40", "Pantop40" all resolve to the same lookup key.
"""
import re


def normalize_token(value: str) -> str:
    """Lowercase, strip punctuation/whitespace, collapse to a comparable key."""
    if not value:
        return ""
    value = value.lower().strip()
    value = re.sub(r"[\-_,./]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_compact(value: str) -> str:
    """An even tighter key with no spaces at all — for fuzzy brand matches
    like 'Pantop 40' vs 'Pantop40'."""
    return re.sub(r"[^a-z0-9]", "", normalize_token(value))


def extract_strength_mg(value: str) -> str:
    """Pull a normalized strength string like '40 mg' out of noisy text."""
    if not value:
        return ""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu)\b", value.lower())
    if match:
        return f"{match.group(1)} {match.group(2)}"
    return value.strip()
