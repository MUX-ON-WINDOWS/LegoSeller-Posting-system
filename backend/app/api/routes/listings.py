import shutil
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.listing import Listing
from app.schemas.listing import LegoCondition, ListingRead, RecognitionRead
from app.services.ai_vision import AIConfigurationError, AIProviderError, analyze_images

router = APIRouter(prefix="/listings", tags=["listings"])
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _photo_urls(listing_id: int) -> list[str]:
    listing_dir = settings.upload_dir / str(listing_id)
    if not listing_dir.exists():
        return []
    return [
        f"/listings/{listing_id}/photos/{path.name}"
        for path in sorted(listing_dir.iterdir())
        if path.is_file()
    ]


def _listing_response(listing: Listing) -> dict[str, object]:
    return {
        "id": listing.id,
        "set_number": listing.set_number,
        "set_name": listing.set_name,
        "condition": listing.condition,
        "is_complete": listing.is_complete,
        "has_box": listing.has_box,
        "has_manual": listing.has_manual,
        "recommended_price_cents": listing.recommended_price_cents,
        "status": listing.status,
        "theme": listing.theme,
        "photos": _photo_urls(listing.id),
    }


@router.get("", response_model=list[ListingRead])
def get_listings(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    listings = db.scalars(select(Listing).order_by(Listing.id.desc())).all()
    return [_listing_response(listing) for listing in listings]


@router.post("", response_model=ListingRead, status_code=status.HTTP_201_CREATED)
def create_listing(
    set_number: str | None = Form(default=None),
    set_name: str | None = Form(default=None),
    condition: LegoCondition = Form(default=LegoCondition.USED),
    is_complete: bool = Form(default=False),
    has_box: bool = Form(default=False),
    has_manual: bool = Form(default=False),
    photos: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
) -> Listing:
    uploaded_photos = photos or []
    if not 1 <= len(uploaded_photos) <= settings.max_uploads_per_listing:
        raise HTTPException(status_code=400, detail="Upload 1 tot 20 foto's.")

    listing = Listing(
        set_number=set_number or None,
        set_name=set_name or None,
        condition=condition.value,
        is_complete=is_complete,
        has_box=has_box,
        has_manual=has_manual,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    listing_dir = settings.upload_dir / str(listing.id)
    listing_dir.mkdir(parents=True, exist_ok=True)
    for photo in uploaded_photos:
        if photo.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Ongeldig bestandstype: {photo.filename}.")
        extension = Path(photo.filename or "").suffix.lower()
        destination = listing_dir / f"{uuid4().hex}{extension}"
        with destination.open("wb") as output:
            shutil.copyfileobj(photo.file, output)

    return _listing_response(listing)


@router.get("/{listing_id}/photos/{filename}")
def get_listing_photo(listing_id: int, filename: str) -> FileResponse:
    listing_dir = settings.upload_dir / str(listing_id)
    photo_path = listing_dir / filename
    if not photo_path.is_file() or photo_path.parent != listing_dir:
        raise HTTPException(status_code=404, detail="Foto niet gevonden.")
    return FileResponse(photo_path)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: int, db: Session = Depends(get_db)) -> None:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Advertentie niet gevonden.")

    listing_dir = settings.upload_dir / str(listing_id)
    db.delete(listing)
    db.commit()
    if listing_dir.exists():
        shutil.rmtree(listing_dir)


@router.post("/{listing_id}/analyze", response_model=RecognitionRead)
async def analyze_listing(listing_id: int, db: Session = Depends(get_db)) -> RecognitionRead:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Advertentie niet gevonden.")
    listing_dir = settings.upload_dir / str(listing_id)
    image_paths = [path for path in listing_dir.iterdir() if path.is_file()]
    try:
        recognition = await analyze_images(image_paths)
    except AIConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AIProviderError as error:
        raise HTTPException(status_code=502, detail=f"AI-provider: {error}") from error
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=(
                "Google AI Studio kon niet worden bereikt. Controleer internet, "
                "proxy en GOOGLE_AI_BASE_URL."
            ),
        ) from error

    listing.set_number = recognition.set_number or listing.set_number
    listing.set_name = recognition.set_name or listing.set_name
    listing.theme = recognition.theme
    if recognition.condition in {item.value for item in LegoCondition}:
        listing.condition = recognition.condition
    db.commit()
    return recognition
