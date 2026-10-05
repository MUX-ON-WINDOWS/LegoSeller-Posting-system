import shutil
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.listing import Listing
from app.schemas.listing import LegoCondition, ListingRead, RecognitionRead
from app.services.ai_vision import AIConfigurationError, AIProviderError, analyze_images

router = APIRouter(prefix="/listings", tags=["listings"])
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


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

    return listing


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
            detail="AI-provider kon niet worden bereikt. Controleer internet, proxy en AI_BASE_URL.",
        ) from error

    listing.set_number = recognition.set_number or listing.set_number
    listing.set_name = recognition.set_name or listing.set_name
    listing.theme = recognition.theme
    if recognition.condition in {item.value for item in LegoCondition}:
        listing.condition = recognition.condition
    db.commit()
    return recognition
