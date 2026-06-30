"""Shipper-prospect schemas (S2)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProspectBase(BaseModel):
    company_name: str
    domain: str | None = None
    industry: str | None = None
    city: str | None = None
    state: str | None = None
    website: str | None = None
    contact_name: str | None = None
    contact_title: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    source: str | None = None
    notes: str | None = None


class ProspectCreate(ProspectBase):
    # Optional explicit score; computed from industry when omitted.
    freight_fit_score: int | None = None
    fit_reason: str | None = None


class ProspectUpdate(BaseModel):
    company_name: str | None = None
    domain: str | None = None
    industry: str | None = None
    city: str | None = None
    state: str | None = None
    website: str | None = None
    contact_name: str | None = None
    contact_title: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    source: str | None = None
    notes: str | None = None
    status: str | None = None


class DuplicateRef(BaseModel):
    id: int
    name: str


class ProspectOut(ProspectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    freight_fit_score: int | None
    fit_reason: str | None
    status: str
    shipper_id: int | None
    contact_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    # Resolved at read time: an existing shipper this prospect likely duplicates.
    duplicate_of: DuplicateRef | None = None
