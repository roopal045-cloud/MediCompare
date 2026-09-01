"""
Demo provider. Used automatically when no AI_PROVIDER key is configured,
or as an automatic fallback if a real provider call fails. This is what
powers the "Try Demo Prescription" flow so the whole product can be
demonstrated without any external API key.
"""
import random
from typing import List

from app.ai.base import AIProvider, ExtractedMedicine

# A believable 4-medicine sample prescription, with one deliberately
# low-confidence field so the human-in-the-loop verification UI has
# something real to show off.
SAMPLE_EXTRACTION: List[ExtractedMedicine] = [
    {
        "medicine_name": "Pantop 40",
        "salt": "Pantoprazole",
        "strength": "40 mg",
        "dosage": "1 tablet before breakfast",
        "duration": "5 days",
        "confidence": 0.96,
    },
    {
        "medicine_name": "Ondem 4",
        "salt": "Ondansetron",
        "strength": "4 mg",
        "dosage": "1 tablet twice a day, if needed for nausea",
        "duration": "3 days",
        "confidence": 0.68,
    },
    {
        "medicine_name": "Augmentin 625",
        "salt": "Amoxicillin + Clavulanic Acid",
        "strength": "625 mg",
        "dosage": "1 tablet every 12 hours after food",
        "duration": "5 days",
        "confidence": 0.92,
    },
    {
        "medicine_name": "Dolo 650",
        "salt": "Paracetamol",
        "strength": "650 mg",
        "dosage": "1 tablet, up to 3 times a day if fever/pain",
        "duration": "3 days",
        "confidence": 0.89,
    },
]


class DemoProvider(AIProvider):
    def extract_prescription(self, image_bytes: bytes, mime_type: str) -> List[ExtractedMedicine]:
        # Small deterministic jitter so repeated demo runs feel "alive"
        # without changing the underlying medicines.
        result = []
        for item in SAMPLE_EXTRACTION:
            jitter = round(random.uniform(-0.01, 0.01), 2)
            entry = dict(item)
            entry["confidence"] = max(0.5, min(0.99, round(item["confidence"] + jitter, 2)))
            result.append(entry)
        return result
