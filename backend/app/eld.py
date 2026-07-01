"""ELD / telematics — automatic GPS pings for a load's tracking (feeds F6).

Modes (config.ELD_MODE):
  - "stub" (default): synthesize a plausible location that advances from origin
    toward destination on each poll. No ELD account needed — good for dev/demo.
  - "samsara": call the real provider API (set ELD_API_KEY). Wired later behind
    this same `poll_location` signature.

Returns a dict shaped like a check-call (city, state, latitude, longitude,
status_note, eta), or None if the truck can't be located.
"""
import hashlib
from datetime import datetime, timedelta, timezone

from app import config
from app.models import Load


def _pseudo_point(city: str | None, state: str | None) -> tuple[float, float]:
    """Deterministic lat/lng within the continental US from a place string."""
    key = f"{city or ''},{state or ''}".lower()
    h = hashlib.sha256(key.encode()).hexdigest()
    lat = 30.0 + (int(h[:4], 16) / 0xFFFF) * 15.0   # 30–45 N
    lng = -120.0 + (int(h[4:8], 16) / 0xFFFF) * 45.0  # -120 to -75 W
    return round(lat, 6), round(lng, 6)


def _stub_location(load: Load, progress_index: int) -> dict:
    o_lat, o_lng = _pseudo_point(load.origin_city, load.origin_state)
    d_lat, d_lng = _pseudo_point(load.dest_city, load.dest_state)
    # Each poll advances ~20%, capped near-but-not-at delivery.
    frac = min(0.9, 0.15 + 0.2 * progress_index)
    lat = round(o_lat + (d_lat - o_lat) * frac, 6)
    lng = round(o_lng + (d_lng - o_lng) * frac, 6)

    # Label the ping near whichever endpoint it's closest to.
    if frac < 0.5:
        city, state = load.origin_city, load.origin_state
    else:
        city, state = load.dest_city, load.dest_state

    eta = None
    if load.total_miles:
        remaining_hours = (load.total_miles * (1 - frac)) / 50.0  # ~50 mph avg
        eta = datetime.now(timezone.utc) + timedelta(hours=remaining_hours)

    return {
        "city": city,
        "state": state,
        "latitude": lat,
        "longitude": lng,
        "status_note": "In transit (ELD auto-ping)",
        "eta": eta,
    }


def poll_location(load: Load, progress_index: int) -> dict | None:
    if config.ELD_MODE == "samsara" and config.ELD_API_KEY:
        # Real Samsara/Motive call lands here (same return shape). Until then,
        # fall back to the stub so the feature always works.
        pass
    return _stub_location(load, progress_index)


def is_connected() -> bool:
    return config.ELD_MODE != "stub" and bool(config.ELD_API_KEY)
