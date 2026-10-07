from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ListingStatus(StrEnum):
    ACTIVE = "active"
    SOLD = "sold"


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    set_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    set_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    theme: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    condition: Mapped[str] = mapped_column(String(32), default="used")
    is_complete: Mapped[bool] = mapped_column(default=False)
    has_box: Mapped[bool] = mapped_column(default=False)
    has_manual: Mapped[bool] = mapped_column(default=False)
    recommended_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retail_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vinted_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    marktplaats_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ListingStatus] = mapped_column(
        Enum(ListingStatus), default=ListingStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ListingPhoto(Base):
    __tablename__ = "listing_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    data: Mapped[bytes] = mapped_column(LargeBinary)
