"""Dashboard pin (widget) schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict

PIN_TYPES = ("load", "contact", "carrier", "shipper")


class PinCreate(BaseModel):
    entity_type: str
    entity_id: int
    note: str | None = None
    remind_at: datetime | None = None


class PinUpdate(BaseModel):
    note: str | None = None
    remind_at: datetime | None = None


class PinOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_id: int
    note: str | None
    remind_at: datetime | None
    created_at: datetime
    # Resolved at read time so the dashboard can render + link the widget.
    label: str | None = None
    sublabel: str | None = None
    link: str | None = None
