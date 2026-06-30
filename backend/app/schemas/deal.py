"""Deal schemas (Phase 3)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DealRef(BaseModel):
    """Lightweight linked-record summary embedded on a deal."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ContactRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str | None = None


class DealBase(BaseModel):
    name: str
    amount: Decimal | None = None
    company_id: int | None = None
    primary_contact_id: int | None = None
    expected_close_date: datetime | None = None


class DealCreate(DealBase):
    pipeline_id: int | None = None  # defaults to the org's default pipeline
    stage_id: int | None = None     # defaults to the first stage
    owner_id: int | None = None


class DealUpdate(BaseModel):
    name: str | None = None
    amount: Decimal | None = None
    company_id: int | None = None
    primary_contact_id: int | None = None
    expected_close_date: datetime | None = None
    stage_id: int | None = None
    owner_id: int | None = None


class DealStageUpdate(BaseModel):
    """Body for the kanban drag → stage-change endpoint."""

    stage_id: int


class DealOut(DealBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    pipeline_id: int
    stage_id: int
    owner_id: int | None
    created_by: int | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    company: DealRef | None = None
    primary_contact: ContactRef | None = None
