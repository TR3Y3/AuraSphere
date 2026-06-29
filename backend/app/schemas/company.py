"""Company schemas (Phase 2)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CompanyBase(BaseModel):
    name: str
    domain: str | None = None
    industry: str | None = None
    phone: str | None = None
    website: str | None = None


class CompanyCreate(CompanyBase):
    # Optional explicit owner; defaults to the creator when omitted.
    owner_id: int | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    phone: str | None = None
    website: str | None = None
    owner_id: int | None = None


class CompanyOut(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    owner_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
