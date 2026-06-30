"""Contact schemas (Phase 2)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class ContactBase(BaseModel):
    first_name: str
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    title: str | None = None
    company_id: int | None = None  # shipper link (companies table, interim)
    carrier_id: int | None = None


class ContactCreate(ContactBase):
    owner_id: int | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    title: str | None = None
    company_id: int | None = None
    carrier_id: int | None = None
    owner_id: int | None = None


class ContactRef(BaseModel):
    """Lightweight linked-account summary embedded in a contact."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ContactOut(ContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    owner_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    company: ContactRef | None = None
    carrier: ContactRef | None = None
