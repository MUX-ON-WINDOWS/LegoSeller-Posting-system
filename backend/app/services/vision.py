from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LegoRecognition:
    set_number: str | None = None
    set_name: str | None = None
    theme: str | None = None
    condition: str | None = None


class VisionProvider:
    """Contract for a local vision provider; no external upload is performed here."""

    def analyze(self, image_paths: list[Path]) -> LegoRecognition:
        return LegoRecognition()
