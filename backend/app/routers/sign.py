"""Public rate-con signing — the carrier-facing half of cover/offer.

No login: the single-use token IS the credential (hash-only storage, the same
trust model as password-reset links). Signing records name + IP + timestamp +
document hash, files the signed copy under the load's Documents, and — if the
load was Offered to this carrier — covers it atomically.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session as DbSession

from app import events
from app.database import get_db
from app.models import Document, Load, LoadOption, Organization, RateConfirmation
from app.security import hash_token

router = APIRouter(prefix="/api/sign", tags=["sign"])


class SignView(BaseModel):
    org_name: str
    load_reference: str | None
    carrier_name: str | None
    html: str
    signed: bool
    signed_at: datetime | None
    expired: bool


class SignRequest(BaseModel):
    signer_name: str = Field(min_length=2, max_length=255)


def _rc(db: DbSession, token: str) -> RateConfirmation:
    rc = (
        db.query(RateConfirmation)
        .filter(RateConfirmation.token_hash == hash_token(token))
        .first()
    )
    if rc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="This signing link is invalid.")
    return rc


def _expired(rc: RateConfirmation) -> bool:
    if rc.expires_at is None or rc.signed_at is not None:
        return False
    exp = rc.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < datetime.now(timezone.utc)


@router.get("/{token}", response_model=SignView)
def view_rate_con(token: str, db: DbSession = Depends(get_db)):
    rc = _rc(db, token)
    org = db.query(Organization).filter(Organization.id == rc.organization_id).first()
    load = db.query(Load).filter(Load.id == rc.load_id).first()
    opt = db.query(LoadOption).filter(LoadOption.id == rc.option_id).first() if rc.option_id else None
    return SignView(
        org_name=org.name if org else "AuraSphere",
        load_reference=load.reference if load else None,
        carrier_name=(opt.carrier_name if opt else None) or None,
        html=rc.html,
        signed=rc.signed_at is not None,
        signed_at=rc.signed_at,
        expired=_expired(rc),
    )


@router.post("/{token}", response_model=SignView)
def sign_rate_con(token: str, payload: SignRequest, request: Request,
                  db: DbSession = Depends(get_db)):
    rc = _rc(db, token)
    if rc.signed_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="This rate confirmation is already signed.")
    if _expired(rc):
        raise HTTPException(status_code=status.HTTP_410_GONE,
                            detail="This offer has expired — contact the broker for a new rate con.")

    now = datetime.now(timezone.utc)
    rc.signed_at = now
    rc.signer_name = payload.signer_name
    rc.signer_ip = request.client.host if request.client else None

    # If the load was Offered to this carrier, signing covers it (atomic —
    # a lazy expiry or competing accept loses cleanly).
    load = db.query(Load).filter(Load.id == rc.load_id).first()
    opt = db.query(LoadOption).filter(LoadOption.id == rc.option_id).first() if rc.option_id else None
    if load is not None and opt is not None and load.status == "offered":
        rate = opt.counter_rate if opt.counter_rate is not None else opt.rate
        db.query(Load).filter(
            Load.id == load.id,
            Load.status == "offered",
            or_(Load.offered_carrier_id == opt.carrier_id, Load.offered_carrier_id.is_(None)),
        ).update(
            {"status": "covered", "carrier_id": opt.carrier_id, "carrier_rate": rate,
             "offered_carrier_id": None, "offer_expires_at": None},
            synchronize_session=False,
        )
        opt.status = "accepted"

    # File the signed copy under the load's Documents.
    stamp = (
        f'{rc.html}\n<div style="font-family:Arial;max-width:720px;margin:12px auto;'
        f'border-top:2px solid #111;padding-top:8px;font-size:13px">'
        f"<strong>SIGNED</strong> by {payload.signer_name} on "
        f"{now.strftime('%B %d, %Y %H:%M UTC')} · IP {rc.signer_ip or '—'} · "
        f"doc {rc.doc_hash[:12]}</div>"
    )
    db.add(Document(
        organization_id=rc.organization_id, load_id=rc.load_id,
        filename=f"ratecon-{load.reference if load else rc.load_id}-signed.html",
        content_type="text/html", size=len(stamp.encode()), kind="rate_con",
        data=stamp.encode(), uploaded_by=rc.created_by,
    ))
    events.log_event(
        db, org_id=rc.organization_id, load_id=rc.load_id, event_type="ratecon_signed",
        subject=f"Rate confirmation signed by {payload.signer_name}",
        meta={"doc_hash": rc.doc_hash[:12]},
    )
    db.commit()
    return view_rate_con(token, db)
