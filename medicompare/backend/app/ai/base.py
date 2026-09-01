"""
Common interface every AI provider must implement, plus the normalized
shape returned to the rest of the app.
"""
from abc import ABC, abstractmethod
from typing import List, TypedDict


class ExtractedMedicine(TypedDict):
    medicine_name: str
    salt: str
    strength: str
    dosage: str
    duration: str
    confidence: float


class AIProvider(ABC):
    """Every provider takes raw image bytes + mime type and returns a list
    of extracted medicines. Providers must never raise on partial failure —
    they should return whatever they can and let the caller decide."""

    @abstractmethod
    def extract_prescription(self, image_bytes: bytes, mime_type: str) -> List[ExtractedMedicine]:
        ...
