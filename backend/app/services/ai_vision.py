import base64
import json
from pathlib import Path

import httpx

from app.core.config import settings
from app.services.vision import LegoRecognition


class AIConfigurationError(RuntimeError):
    pass


class AIProviderError(RuntimeError):
    pass


def _parse_recognition_result(response_text: str) -> dict[str, object]:
    try:
        parsed = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise AIProviderError("Google AI Studio gaf geen geldig JSON-antwoord.") from error

    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, list) and len(parsed) == 1 and isinstance(parsed[0], dict):
        return parsed[0]
    raise AIProviderError("Google AI Studio gaf geen herkenningsobject terug.")


async def analyze_images(image_paths: list[Path]) -> LegoRecognition:
    if not settings.google_ai_api_key:
        raise AIConfigurationError("GOOGLE_AI_API_KEY is niet ingesteld in .env.")

    parts: list[dict[str, object]] = [
        {
            "text": (
                "Analyseer deze LEGO-foto's. Lees zichtbare tekst op dozen of handleidingen "
                "met OCR. Geef uitsluitend JSON terug met de velden set_number, set_name, "
                "theme en condition. Gebruik null als iets niet betrouwbaar herkenbaar is. "
                "condition moet new, excellent, good of used zijn."
            )
        }
    ]
    for image_path in image_paths:
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        media_type = {
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(image_path.suffix.lower(), "image/jpeg")
        parts.append({"inline_data": {"mime_type": media_type, "data": encoded}})

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            (
                f"{settings.google_ai_base_url.rstrip('/')}/models/"
                f"{settings.google_ai_model}:generateContent"
            ),
            params={"key": settings.google_ai_api_key},
            json={
                "contents": [{"role": "user", "parts": parts}],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                },
            },
        )
        if response.is_error:
            try:
                provider_detail = response.json().get("error", {}).get("message")
            except ValueError:
                provider_detail = None
            detail = provider_detail or f"Google AI Studio gaf HTTP {response.status_code}."
            raise AIProviderError(detail)

    payload = response.json()
    try:
        response_text = "".join(
            part["text"]
            for part in payload["candidates"][0]["content"]["parts"]
            if "text" in part
        )
    except (KeyError, IndexError, TypeError) as error:
        raise AIProviderError("Google AI Studio gaf geen geldig JSON-antwoord.") from error
    result = _parse_recognition_result(response_text)
    return LegoRecognition(
        set_number=result.get("set_number"),
        set_name=result.get("set_name"),
        theme=result.get("theme"),
        condition=result.get("condition"),
    )
