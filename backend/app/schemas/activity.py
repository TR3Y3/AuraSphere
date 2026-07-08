"""Activity / timeline schemas (F4)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict

ACTIVITY_TYPES = ("call", "email", "note", "task")


class ActivityBase(BaseModel):
    type: str
    subject: str | None = None
    body: str | None = None
    due_at: datetime | None = None
    related_contact_id: int | None = None
    related_company_id: int | None = None  # shipper
    related_load_id: int | None = None
    related_carrier_id: int | None = None


class ActivityCreate(ActivityBase):
    owner_id: int | None = None
    mentions: list[int] | None = None  # user ids @tagged in the note


class ActivityUpdate(BaseModel):
    type: str | None = None
    subject: str | None = None
    body: str | None = None
    due_at: datetime | None = None
    completed: bool | None = None  # convenience: toggles completed_at
    related_contact_id: int | None = None
    related_company_id: int | None = None
    related_load_id: int | None = None
    related_carrier_id: int | None = None


class ActivityOut(ActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    completed_at: datetime | None
    owner_id: int | None
    kind: str = "user"           # 'user' | 'system' (auto-posted feed event)
    event_type: str | None = None
    meta: dict | None = None
    mentions: list[int] | None = None
    created_at: datetime
    updated_at: datetime


class MentionCount(BaseModel):
    count: int
