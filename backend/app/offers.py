"""Shared option/offer logic — designed as the seam the carrier app plugs into.

`create_option()` is the single entry point for adding a carrier option to a
load. The Quote Desk router calls it with source='manual' today; the future
carrier-facing app calls the same function with source='carrier_app'. Keeping
the matching/status logic here means the app lands with zero rework.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DbSession

from app.models import Carrier, CarrierVetting, Load, LoadOption


def _digits(v: str | None) -> str:
    return "".join(ch for ch in (v or "") if ch.isdigit())


def match_carrier(db: DbSession, org_id: int, mc: str | None, dot: str | None) -> Carrier | None:
    """Find the org's carrier by MC or DOT (digit-insensitive match)."""
    mc_d, dot_d = _digits(mc), _digits(dot)
    if not mc_d and not dot_d:
        return None
    for c in db.query(Carrier).filter(Carrier.organization_id == org_id).all():
        if mc_d and _digits(c.mc_number) == mc_d:
            return c
        if dot_d and _digits(c.dot_number) == dot_d:
            return c
    return None


def create_option(db: DbSession, org_id: int, load_id: int, *, source: str,
                  created_by: int | None = None, carrier_id: int | None = None,
                  carrier_name: str | None = None, mc_number: str | None = None,
                  dot_number: str | None = None, rate=None, notes: str | None = None,
                  status: str = "available") -> LoadOption:
    """Create a carrier option; auto-links the carrier by MC/DOT when possible."""
    if carrier_id is None:
        matched = match_carrier(db, org_id, mc_number, dot_number)
        if matched is not None:
            carrier_id = matched.id
            carrier_name = carrier_name or matched.name
    opt = LoadOption(
        organization_id=org_id, load_id=load_id, source=source, created_by=created_by,
        carrier_id=carrier_id, carrier_name=carrier_name,
        mc_number=mc_number, dot_number=dot_number, rate=rate, notes=notes, status=status,
    )
    db.add(opt)
    return opt


def carrier_light(db: DbSession, opt: LoadOption) -> str:
    """Traffic-light bookability for an option, derived live (never stored):
    green = vetted clear + compliant · orange = needs review · red = failed or
    deactivated · grey = carrier not in the system."""
    if opt.carrier_id is None:
        return "grey"
    carrier = db.query(Carrier).filter(Carrier.id == opt.carrier_id).first()
    if carrier is None:
        return "grey"
    if carrier.status == "deactivated":
        return "red"
    vetting = (
        db.query(CarrierVetting)
        .filter(CarrierVetting.carrier_id == carrier.id)
        .order_by(CarrierVetting.id.desc())
        .first()
    )
    if vetting is not None and vetting.result == "fail":
        return "red"
    compliant = carrier.auto_liability is not None and carrier.cargo_coverage is not None
    if vetting is not None and vetting.result == "clear" and compliant:
        return "green"
    return "orange"  # unvetted, vetting=review, or compliance gaps


def resolve_offer_expiry(db: DbSession, load: Load) -> bool:
    """Lazily revert an expired offer: offered → tendered, lock cleared.

    Called on any read/write touch of the load (the board's 15s poll makes
    this effectively automatic). Returns True if a revert happened.
    """
    if load.status != "offered" or load.offer_expires_at is None:
        return False
    expires = load.offer_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires >= datetime.now(timezone.utc):
        return False
    load.status = "tendered"
    load.offered_carrier_id = None
    load.offer_expires_at = None
    db.commit()
    return True


# ── Option expiry (Options board) ────────────────────────────────────────
# Options go stale fast in freight — after OPTION_TTL_HOURS they stop being
# actionable. Expiry is DERIVED from created_at (no column, no scheduler):
# the board classifies at read time and accept/cover enforce it.

OPEN_OPTION_STATUSES = ("available", "countered")
# Load statuses where coverage is still being worked — options on loads past
# this window are no longer opportunities.
COVERAGE_LOAD_STATUSES = ("quote", "tendered", "offered")


def option_expires_at(opt: LoadOption) -> datetime:
    from datetime import timedelta

    from app import config
    created = opt.created_at
    if created.tzinfo is None:  # SQLite returns naive UTC
        created = created.replace(tzinfo=timezone.utc)
    return created + timedelta(hours=config.OPTION_TTL_HOURS)


def option_is_expired(opt: LoadOption) -> bool:
    return datetime.now(timezone.utc) >= option_expires_at(opt)


def option_is_active(opt: LoadOption, load: Load) -> bool:
    """Active = still actionable: open status, not expired, and the load is
    still in its coverage phase (not covered/booked/terminal)."""
    return (
        opt.status in OPEN_OPTION_STATUSES
        and not option_is_expired(opt)
        and load.status in COVERAGE_LOAD_STATUSES
    )
