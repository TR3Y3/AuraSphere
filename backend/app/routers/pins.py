"""Dashboard pins (widgets) — per-user, org-scoped.

A pin references a load / contact / carrier / shipper the user wants on
their dashboard, with an optional note and reminder time. The entity label
+ link are resolved at read time so the frontend can render the widget.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import OrgScope, get_scope
from app.models import Carrier, Company, Contact, Load, Pin
from app.schemas.pin import PIN_TYPES, PinCreate, PinOut, PinUpdate

router = APIRouter(prefix="/api/pins", tags=["pins"])


def _resolve(scope: OrgScope, entity_type: str, entity_id: int):
    """Return (label, sublabel, link) for an in-org entity, or None if gone."""
    if entity_type == "load":
        obj = scope.query(Load).filter(Load.id == entity_id).first()
        if obj:
            route = " → ".join(p for p in [obj.origin_city, obj.dest_city] if p)
            return (obj.reference or f"Load {obj.id}", route or obj.status, f"/loads/{obj.id}")
    elif entity_type == "contact":
        obj = scope.query(Contact).filter(Contact.id == entity_id).first()
        if obj:
            name = f"{obj.first_name} {obj.last_name or ''}".strip()
            return (name, obj.title or obj.email, f"/contacts/{obj.id}")
    elif entity_type == "carrier":
        obj = scope.query(Carrier).filter(Carrier.id == entity_id).first()
        if obj:
            return (obj.name, obj.phone or obj.mc_number, f"/carriers/{obj.id}")
    elif entity_type == "shipper":
        obj = scope.query(Company).filter(Company.id == entity_id).first()
        if obj:
            return (obj.name, obj.industry, f"/companies/{obj.id}")
    return None


def _serialize(scope: OrgScope, pin: Pin) -> PinOut:
    out = PinOut.model_validate(pin)
    resolved = _resolve(scope, pin.entity_type, pin.entity_id)
    if resolved:
        out.label, out.sublabel, out.link = resolved
    return out


@router.get("", response_model=list[PinOut])
def list_pins(scope: OrgScope = Depends(get_scope)):
    pins = (
        scope.query(Pin)
        .filter(Pin.user_id == scope.user.id)
        .order_by(Pin.created_at.desc())
        .all()
    )
    return [_serialize(scope, p) for p in pins]


@router.post("", response_model=PinOut, status_code=status.HTTP_201_CREATED)
def create_pin(payload: PinCreate, scope: OrgScope = Depends(get_scope)):
    if payload.entity_type not in PIN_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"entity_type must be one of {', '.join(PIN_TYPES)}")
    if _resolve(scope, payload.entity_type, payload.entity_id) is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="entity does not exist in your organization")
    # Idempotent: reuse an existing pin for the same entity if present.
    existing = (
        scope.query(Pin)
        .filter(
            Pin.user_id == scope.user.id,
            Pin.entity_type == payload.entity_type,
            Pin.entity_id == payload.entity_id,
        )
        .first()
    )
    pin = existing or Pin(
        organization_id=scope.org_id,
        user_id=scope.user.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
    )
    pin.note = payload.note
    pin.remind_at = payload.remind_at
    if existing is None:
        scope.db.add(pin)
    scope.db.commit()
    scope.db.refresh(pin)
    return _serialize(scope, pin)


def _get_owned(scope: OrgScope, pin_id: int) -> Pin:
    pin = (
        scope.query(Pin)
        .filter(Pin.id == pin_id, Pin.user_id == scope.user.id)
        .first()
    )
    if pin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return pin


@router.patch("/{pin_id}", response_model=PinOut)
def update_pin(pin_id: int, payload: PinUpdate, scope: OrgScope = Depends(get_scope)):
    pin = _get_owned(scope, pin_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pin, field, value)
    scope.db.commit()
    scope.db.refresh(pin)
    return _serialize(scope, pin)


@router.delete("/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pin(pin_id: int, scope: OrgScope = Depends(get_scope)):
    pin = _get_owned(scope, pin_id)
    scope.db.delete(pin)
    scope.db.commit()
