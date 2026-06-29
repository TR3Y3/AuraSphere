"""Minimal company schema (Phase 1).

Phase 2 builds full Contacts + Companies CRUD; here we expose a single
org-scoped read endpoint purely to prove tenant isolation end to end.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    domain: str | None
    industry: str | None
    owner_id: int | None
    organization_id: int
    created_at: datetime
