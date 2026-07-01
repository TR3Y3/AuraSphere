"""Carrier vetting schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CarrierVettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    carrier_id: int
    source: str
    result: str  # clear / review / fail
    authority_status: str | None
    insurance_on_file: bool
    safety_rating: str | None
    risk_score: int | None
    flags: list[str]
    checked_by: int | None
    created_at: datetime
