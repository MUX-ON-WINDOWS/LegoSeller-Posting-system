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


async def analyze_images(image_paths: list[Path]) -> LegoRecognition:
    if not settings.ai_api_key:
        raise AIConfigurationError("AI_API_KEY is niet ingesteld in .env.")

    content: list[dict[str, object]] = [
        {
            "type": "text",
            "text": (
                "Analyseer deze LEGO-foto's. Lees zichtbare tekst op dozen of handleidingen "
                "met OCR. Geef uitsluitend JSON terug met de velden set_number, set_name, "
                "theme en condition. Gebruik null als iets niet betrouwbaar herkenbaar is. "
                "condition moet new, excellent, good of used zijn."
            ),
        }
    ]
    for image_path in image_paths:
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        media_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
        content.append(
            {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{encoded}"}}
        )

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"{settings.ai_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.ai_api_key}"},
            json={
                "model": settings.ai_model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": content}],
            },
        )
        if response.is_error:
            try:
                provider_detail = response.json().get("error", {}).get("message")
            except ValueError:
                provider_detail = None
            detail = provider_detail or f"AI-provider gaf HTTP {response.status_code}."
            raise AIProviderError(detail)

    payload = response.json()
    try:
        result = json.loads(payload["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise AIProviderError("AI-provider gaf geen geldig JSON-antwoord.") from error
    return LegoRecognition(
        set_number=result.get("set_number"),
        set_name=result.get("set_name"),
        theme=result.get("theme"),
        condition=result.get("condition"),
    )
