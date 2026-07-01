"""DAT market-rate schemas."""
from pydantic import BaseModel


class MarketRateOut(BaseModel):
    source: str
    equipment: str | None
    miles: int | None
    rate_per_mile_low: float
    rate_per_mile_avg: float
    rate_per_mile_high: float
    total_low: float | None
    total_avg: float | None
    total_high: float | None
    confidence: str
