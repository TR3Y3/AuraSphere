"""Quote Desk — carrier options on a load (S1, org-scoped).

Customer- and carrier-facing reps work the same load's options. Accepting
an option covers the load with that carrier + rate.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app import config, events, offers
from app.deps import OrgScope, get_scope
from app.email import send_email
from app.models import Carrier, Load, LoadOption, Organization, RateConfirmation
from app.ratecon import doc_hash, render_rate_con
from app.schemas.load import LoadOut
from app.schemas.load_option import (
    OPTION_STATUSES,
    CoverResult,
    OfferRequest,
    OptionCreate,
    OptionOut,
    OptionUpdate,
)
from app.security import generate_session_token, hash_token

router = APIRouter(prefix="/api/loads", tags=["quote-desk"])


def _load(scope: OrgScope, load_id: int) -> Load:
    obj = scope.query(Load).filter(Load.id == load_id).first()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load not found")
    offers.resolve_offer_expiry(scope.db, obj)  # lazily revert an expired offer
    return obj


def _serialize(scope: OrgScope, opt: LoadOption) -> OptionOut:
    out = OptionOut.model_validate(opt)
    out.carrier_light = offers.carrier_light(scope.db, opt)
    return out


def _option(scope: OrgScope, load_id: int, option_id: int) -> LoadOption:
    opt = (
        scope.query(LoadOption)
        .options(joinedload(LoadOption.carrier))
        .filter(LoadOption.id == option_id, LoadOption.load_id == load_id)
        .first()
    )
    if opt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found")
    return opt


def _check_carrier(scope: OrgScope, carrier_id: int | None) -> None:
    if carrier_id is not None and (
        scope.query(Carrier).filter(Carrier.id == carrier_id).first() is None
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="carrier_id is not a carrier in your organization")


def _validate_status(value: str | None) -> None:
    if value is not None and value not in OPTION_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"status must be one of {', '.join(OPTION_STATUSES)}")


@router.get("/{load_id}/options", response_model=list[OptionOut])
def list_options(load_id: int, scope: OrgScope = Depends(get_scope)):
    _load(scope, load_id)
    opts = (
        scope.query(LoadOption)
        .options(joinedload(LoadOption.carrier))
        .filter(LoadOption.load_id == load_id)
        .order_by(LoadOption.rate.asc().nulls_last(), LoadOption.created_at)
        .all()
    )
    return [_serialize(scope, o) for o in opts]


@router.post("/{load_id}/options", response_model=OptionOut, status_code=status.HTTP_201_CREATED)
def add_option(load_id: int, payload: OptionCreate, scope: OrgScope = Depends(get_scope)):
    """Rep-entered option. The future carrier app calls offers.create_option
    with source='carrier_app' — same seam, zero rework."""
    _load(scope, load_id)
    _check_carrier(scope, payload.carrier_id)
    _validate_status(payload.status)
    opt = offers.create_option(
        scope.db, scope.org_id, load_id, source="manual", created_by=scope.user.id,
        **payload.model_dump(exclude={"status"}), status=payload.status,
    )
    scope.db.commit()
    scope.db.refresh(opt)
    return _serialize(scope, opt)


@router.patch("/{load_id}/options/{option_id}", response_model=OptionOut)
def update_option(load_id: int, option_id: int, payload: OptionUpdate, scope: OrgScope = Depends(get_scope)):
    opt = _option(scope, load_id, option_id)
    data = payload.model_dump(exclude_unset=True)
    if "carrier_id" in data:
        _check_carrier(scope, data["carrier_id"])
    if "status" in data:
        _validate_status(data["status"])
    for field, value in data.items():
        setattr(opt, field, value)
    scope.db.commit()
    scope.db.refresh(opt)
    return opt


@router.delete("/{load_id}/options/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_option(load_id: int, option_id: int, scope: OrgScope = Depends(get_scope)):
    opt = _option(scope, load_id, option_id)
    scope.db.delete(opt)
    scope.db.commit()


@router.post("/{load_id}/options/{option_id}/accept", response_model=LoadOut)
def accept_option(load_id: int, option_id: int, scope: OrgScope = Depends(get_scope)):
    """Cover the load with this option's carrier + rate, mark it accepted."""
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    opt = _option(scope, load_id, option_id)

    # Atomic claim: the status check-and-set happens in ONE UPDATE, so two reps
    # accepting different options concurrently can't both win — the loser's
    # UPDATE matches zero rows (status already advanced) and gets a 409.
    rate = opt.counter_rate if opt.counter_rate is not None else opt.rate
    claimed = (
        scope.db.query(Load)
        .filter(
            Load.id == load_id,
            Load.organization_id == scope.org_id,
            Load.status.in_(("quote", "tendered", "offered")),
            # Offered-lock: while offered, only the offered carrier can win it.
            or_(Load.status != "offered", Load.offered_carrier_id == opt.carrier_id),
        )
        .update(
            {"status": "covered", "carrier_id": opt.carrier_id, "carrier_rate": rate,
             "offered_carrier_id": None, "offer_expires_at": None},
            synchronize_session=False,
        )
    )
    if claimed == 0:
        scope.db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This load is covered or locked to another carrier's offer.",
        )
    opt.status = "accepted"
    # Any other open option steps aside.
    for other in scope.query(LoadOption).filter(
        LoadOption.load_id == load_id, LoadOption.id != option_id, LoadOption.status == "available"
    ):
        other.status = "declined"
    carrier = scope.query(Carrier).filter(Carrier.id == opt.carrier_id).first()
    events.log_event(
        scope.db, org_id=scope.org_id, load_id=load_id, event_type="status_change",
        subject=f"Covered with {(carrier.name if carrier else None) or opt.carrier_name or 'carrier'}"
                f" at ${rate}",
        meta={"from": load.status, "to": "covered", "carrier_id": opt.carrier_id},
        actor_id=scope.user.id,
    )
    scope.db.commit()

    refreshed = (
        scope.query(Load)
        .options(joinedload(Load.shipper), joinedload(Load.carrier), joinedload(Load.primary_contact))
        .filter(Load.id == load_id)
        .first()
    )
    return refreshed


def _issue_ratecon(scope: OrgScope, load: Load, opt: LoadOption,
                   expires_at=None) -> tuple[RateConfirmation, str]:
    """Generate the rate con + a single-use public sign link for the carrier."""
    org = scope.db.query(Organization).filter(Organization.id == scope.org_id).first()
    carrier = opt.carrier
    carrier_name = (carrier.name if carrier else None) or opt.carrier_name or "Carrier"
    rate = opt.counter_rate if opt.counter_rate is not None else opt.rate
    html = render_rate_con(org, load, carrier, carrier_name, rate)

    token = generate_session_token()
    rc = RateConfirmation(
        organization_id=scope.org_id, load_id=load.id, option_id=opt.id,
        carrier_id=opt.carrier_id, token_hash=hash_token(token),
        html=html, doc_hash=doc_hash(html),
        sent_to=(carrier.email if carrier else None),
        expires_at=expires_at, created_by=scope.user.id,
    )
    scope.db.add(rc)
    events.log_event(
        scope.db, org_id=scope.org_id, load_id=load.id, event_type="ratecon_sent",
        subject=f"Rate confirmation sent to {carrier_name}"
                + (f" ({rc.sent_to})" if rc.sent_to else ""),
        actor_id=scope.user.id,
    )
    sign_url = f"{config.FRONTEND_ORIGIN}/sign?token={token}"
    if rc.sent_to:
        send_email(
            rc.sent_to,
            f"Rate confirmation — load {load.reference} ({org.name})",
            f"{org.name} has covered load {load.reference} with you.\n\n"
            f"Review and sign the rate confirmation here:\n\n{sign_url}\n"
            + (f"\nThis offer expires at {expires_at:%H:%M %Z}." if expires_at else ""),
        )
    return rc, sign_url


@router.post("/{load_id}/options/{option_id}/cover", response_model=CoverResult)
def cover_with_ratecon(load_id: int, option_id: int, scope: OrgScope = Depends(get_scope)):
    """One click on a green option: cover the load AND send the rate con to sign.

    Backend re-checks bookability — the UI only shows this on green, but the
    server is the enforcement point.
    """
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    opt = _option(scope, load_id, option_id)
    light = offers.carrier_light(scope.db, opt)
    if light != "green":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Carrier is not clear to book (status: {light}). Vet the carrier first.",
        )

    accept_option(load_id, option_id, scope)  # atomic, race-safe, lock-aware
    load = _load(scope, load_id)
    rc, sign_url = _issue_ratecon(scope, load, opt)
    scope.db.commit()
    exposed = sign_url if config.EMAIL_DELIVERY == "console" else None
    return CoverResult(load=LoadOut.model_validate(load), sign_url=exposed,
                       sent_to=rc.sent_to)


@router.post("/{load_id}/offer", response_model=CoverResult)
def offer_to_carrier(load_id: int, payload: OfferRequest, scope: OrgScope = Depends(get_scope)):
    """Lock the load to one option's carrier while they sign (Offered status).

    Atomic tendered/quote → offered claim; expires after ttl_minutes (5–15,
    default OFFER_TTL_MINUTES) and lazily reverts to Tendered. Signing the
    rate con within the window covers the load.
    """
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    opt = _option(scope, load_id, payload.option_id)
    if opt.carrier_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Add this carrier to the system before offering the load.")
    light = offers.carrier_light(scope.db, opt)
    if light == "red":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Carrier is not approved (red) — it cannot be offered this load.")

    ttl = max(5, min(15, payload.ttl_minutes or config.OFFER_TTL_MINUTES))
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl)
    claimed = (
        scope.db.query(Load)
        .filter(Load.id == load_id, Load.organization_id == scope.org_id,
                Load.status.in_(("quote", "tendered")))
        .update({"status": "offered", "offered_carrier_id": opt.carrier_id,
                 "offer_expires_at": expires}, synchronize_session=False)
    )
    if claimed == 0:
        scope.db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="This load can't be offered right now (already offered or covered).")

    load = scope.query(Load).filter(Load.id == load_id).first()
    rc, sign_url = _issue_ratecon(scope, load, opt, expires_at=expires)
    scope.db.commit()
    scope.db.refresh(load)
    exposed = sign_url if config.EMAIL_DELIVERY == "console" else None
    return CoverResult(load=LoadOut.model_validate(load), sign_url=exposed, sent_to=rc.sent_to)
