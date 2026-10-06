from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class LegoCondition(StrEnum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    USED = "used"


class ListingCreate(BaseModel):
    set_number: str | None = Field(default=None, max_length=32)
    set_name: str | None = Field(default=None, max_length=200)
    condition: LegoCondition = LegoCondition.USED
    is_complete: bool = False
    has_box: bool = False
    has_manual: bool = False


class ListingRead(ListingCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    recommended_price_cents: int | None = None
    theme: str | None = None
    photos: list[str] = Field(default_factory=list)


class RecognitionRead(BaseModel):
    set_number: str | None = None
    set_name: str | None = None
    theme: str | None = None
    condition: str | None = None
