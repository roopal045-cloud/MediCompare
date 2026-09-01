"""
AIService: the single entry point the rest of the app uses. Picks the
configured provider and — critically for the hackathon demo — never lets
an AI failure crash the request. If the real provider errors out (missing
key, network issue, rate limit, bad response) it transparently falls back
to the demo provider and tells the caller that happened.
"""
import logging
from typing import List, Tuple

from app.ai.base import ExtractedMedicine
from app.ai.demo_provider import DemoProvider
from app.config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.provider_name = settings.AI_PROVIDER.lower()
        self.demo_provider = DemoProvider()

    def _build_real_provider(self):
        if self.provider_name == "gemini":
            from app.ai.gemini_provider import GeminiProvider
            return GeminiProvider()
        if self.provider_name == "openai":
            from app.ai.openai_provider import OpenAIProvider
            return OpenAIProvider()
        return None

    def extract_prescription(
        self, image_bytes: bytes, mime_type: str, force_demo: bool = False
    ) -> Tuple[List[ExtractedMedicine], bool, str]:
        """
        Returns (medicines, used_demo_fallback, provider_used).
        """
        if force_demo or self.provider_name == "demo":
            return self.demo_provider.extract_prescription(image_bytes, mime_type), True, "demo"

        provider = self._build_real_provider()
        if provider is None:
            return self.demo_provider.extract_prescription(image_bytes, mime_type), True, "demo"

        try:
            result = provider.extract_prescription(image_bytes, mime_type)
            if not result:
                raise ValueError("Provider returned no medicines")
            return result, False, self.provider_name
        except Exception as exc:  # noqa: BLE001 - intentional broad catch for demo resilience
            logger.warning("AI provider '%s' failed, falling back to demo: %s", self.provider_name, exc)
            return self.demo_provider.extract_prescription(image_bytes, mime_type), True, "demo"


ai_service = AIService()
