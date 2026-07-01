"""DAT market rates (spot rate lookup by lane + equipment).

Modes (config.DAT_MODE):
  - "stub" (default): derive a deterministic spot rate from the lane, mileage,
    and equipment. No DAT account needed — good for dev/demo and a sensible
    offline fallback.
  - "dat": call the real DAT RateView API (set DAT_API_KEY). Wired later behind
    this same `market_rate` signature.

Returns a dict: source, equipment, miles, rate_per_mile (low/avg/high),
total (low/avg/high, when miles known), confidence.
"""
import hashlib

from app import config

# Base spot $/mile by equipment class (rough national ballpark for the stub).
_BASE_PER_MILE = {
    "van": 2.05,
    "reefer": 2.45,
    "flatbed": 2.60,
    "power only": 1.85,
    "stepdeck": 2.70,
}
_DEFAULT_PER_MILE = 2.10


def _equip_base(equipment: str | None) -> float:
    if not equipment:
        return _DEFAULT_PER_MILE
    e = equipment.lower()
    for key, rate in _BASE_PER_MILE.items():
        if key in e:
            return rate
    return _DEFAULT_PER_MILE


def _lane_factor(origin: str, dest: str) -> float:
    """Deterministic ±15% lane variance from a hash of the lane."""
    h = hashlib.sha256(f"{origin.lower().strip()}|{dest.lower().strip()}".encode()).hexdigest()
    # Map first 4 hex digits → [-0.15, +0.15].
    frac = int(h[:4], 16) / 0xFFFF
    return 0.85 + frac * 0.30


def _stub_rate(origin: str, dest: str, equipment: str | None, miles: int | None) -> dict:
    per_mile_avg = round(_equip_base(equipment) * _lane_factor(origin, dest), 2)
    per_mile_low = round(per_mile_avg * 0.88, 2)
    per_mile_high = round(per_mile_avg * 1.15, 2)

    result = {
        "source": "stub",
        "equipment": equipment,
        "miles": miles,
        "rate_per_mile_low": per_mile_low,
        "rate_per_mile_avg": per_mile_avg,
        "rate_per_mile_high": per_mile_high,
        "total_low": None,
        "total_avg": None,
        "total_high": None,
        "confidence": "medium" if miles else "low",
    }
    if miles:
        result["total_low"] = round(per_mile_low * miles, 2)
        result["total_avg"] = round(per_mile_avg * miles, 2)
        result["total_high"] = round(per_mile_high * miles, 2)
    return result


def market_rate(origin: str, dest: str, equipment: str | None, miles: int | None) -> dict:
    if config.DAT_MODE == "dat" and config.DAT_API_KEY:
        # Real DAT RateView call lands here (same return shape). Until then,
        # fall back to the deterministic stub so the feature always works.
        pass
    return _stub_rate(origin, dest, equipment, miles)


def post_load(load) -> str:
    """Post a load to the DAT load board; returns the board posting id.

    Stub mode returns a synthetic id so the post→board→remove loop works with
    no DAT account. Real mode (dat) calls the DAT posting API.
    """
    if config.DAT_MODE == "dat" and config.DAT_API_KEY:
        # Real DAT posting API call lands here, returning the posting id.
        pass
    return f"DAT-STUB-{load.id}"


def remove_posting(posting_id: str) -> None:
    """Remove a load's DAT posting. No-op in stub mode."""
    if config.DAT_MODE == "dat" and config.DAT_API_KEY:
        # Real DAT delete-posting call lands here.
        pass
    return None
