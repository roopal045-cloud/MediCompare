"""
Gemini-backed provider. Uses Gemini's multimodal API to read a prescription
image and return structured medicine data as JSON.
"""
import base64
import json
import logging
from typing import List

import requests

from app.ai.base import AIProvider, ExtractedMedicine
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)

PROMPT = """You are reading a handwritten or printed doctor's prescription image.
Extract every medicine mentioned. For each medicine return:
- medicine_name (brand name as written)
- salt (active ingredient / generic name, best guess)
- strength (e.g. "40 mg")
- dosage (instructions, e.g. "1 tablet twice a day after food")
- duration (e.g. "5 days")
- confidence (0 to 1, how sure you are of this extraction overall)

Respond with ONLY a JSON array of objects with exactly those fields. No prose,
no markdown fences, no extra commentary."""


class GeminiProvider(AIProvider):
    def extract_prescription(self, image_bytes: bytes, mime_type: str) -> List[ExtractedMedicine]:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT},
                        {"inline_data": {"mime_type": mime_type, "data": b64_image}},
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.2},
        }
        resp = requests.post(
            f"{GEMINI_ENDPOINT}?key={settings.GEMINI_API_KEY}",
            json=body,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(text)
        return [
            {
                "medicine_name": item.get("medicine_name", "").strip(),
                "salt": item.get("salt", "").strip(),
                "strength": item.get("strength", "").strip(),
                "dosage": item.get("dosage", "").strip(),
                "duration": item.get("duration", "").strip(),
                "confidence": float(item.get("confidence", 0.5)),
            }
            for item in parsed
            if item.get("medicine_name")
        ]
