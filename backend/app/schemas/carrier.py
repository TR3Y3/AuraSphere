"""Carrier schemas (freight pivot, F1)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class CarrierBase(BaseModel):
    name: str
    mc_number: str | None = None
    dot_number: str | None = None
    hq_city: str | None = None
    hq_state: str | None = None
    phone: str | None = None
    email: str | None = None
    status: str = "active"
    rating: Decimal | None = None
    on_time_pct: int | None = None
    tracking_pct: int | None = None
    bounce_pct: int | None = None
    auto_liability: Decimal | None = None
    cargo_coverage: Decimal | None = None
    equipment_types: str | None = None


class CarrierCreate(CarrierBase):
    owner_id: int | None = None


class CarrierUpdate(BaseModel):
    name: str | None = None
    mc_number: str | None = None
    dot_number: str | None = None
    hq_city: str | None = None
    hq_state: str | None = None
    phone: str | None = None
    email: str | None = None
    status: str | None = None
    rating: Decimal | None = None
    on_time_pct: int | None = None
    tracking_pct: int | None = None
    bounce_pct: int | None = None
    auto_liability: Decimal | None = None
    cargo_coverage: Decimal | None = None
    equipment_types: str | None = None
    owner_id: int | None = None


class CarrierOut(CarrierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    portal_token_hash: str | None = Field(default=None, exclude=True)
    owner_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def compliance_issues(self) -> list[str]:
        """Loud flags — what's missing/wrong for booking this carrier."""
        issues: list[str] = []
        if self.status == "deactivated":
            issues.append("Carrier is deactivated")
        if self.auto_liability is None:
            issues.append("No auto liability on file")
        if self.cargo_coverage is None:
            issues.append("No cargo coverage on file")
        return issues

    @computed_field
    @property
    def is_compliant(self) -> bool:
        return len(self.compliance_issues) == 0

    @computed_field
    @property
    def portal_enabled(self) -> bool:
        return self.portal_token_hash is not None
