"""
OpenAI-backed provider. Uses a vision-capable chat completion to read a
prescription image and return structured medicine data as JSON.
"""
import base64
import json
import logging
from typing import List

import requests

from app.ai.base import AIProvider, ExtractedMedicine
from app.config import settings

logger = logging.getLogger(__name__)

OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"

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


class OpenAIProvider(AIProvider):
    def extract_prescription(self, image_bytes: bytes, mime_type: str) -> List[ExtractedMedicine]:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        body = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                        },
                    ],
                }
            ],
            "temperature": 0.2,
        }
        resp = requests.post(
            OPENAI_ENDPOINT,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
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
