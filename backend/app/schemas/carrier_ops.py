"""Carrier ops schemas: derived lane history + posted capacity (F3)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class LaneOut(BaseModel):
    """A lane the carrier has run, aggregated from its loads."""

    origin: str
    destination: str
    equipment: str | None = None
    shipments: int
    last_rate: Decimal | None = None
    last_ran: datetime | None = None


class CapacityCreate(BaseModel):
    location: str
    radius_miles: int | None = None
    weekly_capacity: int | None = None
    equipment: str | None = None
    notes: str | None = None


class CapacityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    carrier_id: int
    location: str
    radius_miles: int | None
    weekly_capacity: int | None
    equipment: str | None
    notes: str | None
    created_at: datetime
