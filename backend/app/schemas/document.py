"""Load document (attachment) schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    load_id: int
    filename: str
    content_type: str | None
    size: int
    kind: str | None
    uploaded_by: int | None
    created_at: datetime
