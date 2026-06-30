"""Quote Desk carrier-option schemas (S1)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

OPTION_STATUSES = ("available", "not_available", "countered", "declined", "accepted")


class CarrierRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class OptionCreate(BaseModel):
    carrier_id: int | None = None
    carrier_name: str | None = None
    rate: Decimal | None = None
    status: str = "available"
    notes: str | None = None


class OptionUpdate(BaseModel):
    carrier_id: int | None = None
    carrier_name: str | None = None
    rate: Decimal | None = None
    counter_rate: Decimal | None = None
    status: str | None = None
    notes: str | None = None


class OptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    load_id: int
    carrier_id: int | None
    carrier_name: str | None
    rate: Decimal | None
    counter_rate: Decimal | None
    status: str
    notes: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    carrier: CarrierRef | None = None
