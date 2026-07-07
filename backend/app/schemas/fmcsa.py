"""FMCSA carrier-lookup schema."""
from pydantic import BaseModel


class CarrierLookupOut(BaseModel):
    found: bool
    source: str
    legal_name: str | None = None
    mc_number: str | None = None
    dot_number: str | None = None
    city: str | None = None
    state: str | None = None
    phone: str | None = None
    authority_status: str | None = None
