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
    mc_number: str | None = None
    dot_number: str | None = None
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
    mc_number: str | None = None
    dot_number: str | None = None
    source: str = "manual"
    # Traffic-light bookability, derived from vetting/compliance at read time:
    # green | orange | red | grey (not in system).
    carrier_light: str | None = None
    rate: Decimal | None
    counter_rate: Decimal | None
    status: str
    notes: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    carrier: CarrierRef | None = None
    # Derived shelf life (created_at + OPTION_TTL_HOURS) — set at read time.
    expires_at: datetime | None = None
    is_expired: bool = False


class BoardOption(BaseModel):
    """One row on the org-wide Options board: the option + enough load and
    carrier context to act without opening the load first."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    load_id: int
    load_reference: str | None
    load_status: str
    origin_city: str | None
    origin_state: str | None
    dest_city: str | None
    dest_state: str | None
    pickup_date: datetime | None
    delivery_date: datetime | None
    equipment: str | None
    customer_rate: Decimal | None
    carrier_id: int | None
    carrier_name: str | None
    carrier_phone: str | None = None
    carrier_email: str | None = None
    mc_number: str | None = None
    source: str = "manual"
    carrier_light: str | None = None
    rate: Decimal | None
    counter_rate: Decimal | None
    margin: Decimal | None = None  # customer_rate − (counter or rate)
    status: str
    notes: str | None
    created_at: datetime
    expires_at: datetime
    is_expired: bool
    active: bool


class OfferRequest(BaseModel):
    option_id: int
    ttl_minutes: int | None = None  # 5–15; defaults to OFFER_TTL_MINUTES


class CoverResult(BaseModel):
    load: "LoadOut"
    # Exposed only in console email mode so the sign flow is testable
    # without a mailbox (same pattern as signup/invite links).
    sign_url: str | None = None
    sent_to: str | None = None


from app.schemas.load import LoadOut  # noqa: E402 — resolve forward ref

CoverResult.model_rebuild()
