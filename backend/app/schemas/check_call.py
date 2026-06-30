"""Check-call / tracking ping schemas (F6)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CheckCallCreate(BaseModel):
    city: str | None = None
    state: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    status_note: str | None = None
    note: str | None = None
    eta: datetime | None = None
    reported_at: datetime | None = None
    # Optional tracking hook: advance the load to this status when logged.
    advance_status: str | None = None


class CheckCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    load_id: int
    city: str | None
    state: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    status_note: str | None
    note: str | None
    eta: datetime | None
    reported_at: datetime
    created_by: int | None
    created_at: datetime
