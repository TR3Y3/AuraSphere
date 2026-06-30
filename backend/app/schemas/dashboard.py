"""Dashboard + pricing analytics schemas (F5)."""
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.activity import ActivityOut


class StatusValue(BaseModel):
    status: str
    count: int
    value: Decimal


class DashboardSummary(BaseModel):
    loads_total: int
    open_loads: int
    loaded_dollars: Decimal
    total_margin: Decimal
    avg_margin: Decimal | None
    value_by_status: list[StatusValue]
    open_tasks: int
    recent_activity: list[ActivityOut]


class LanePrice(BaseModel):
    origin: str
    destination: str
    equipment: str | None
    loads: int
    avg_customer_rate: Decimal | None
    avg_carrier_rate: Decimal | None
    avg_margin: Decimal | None
