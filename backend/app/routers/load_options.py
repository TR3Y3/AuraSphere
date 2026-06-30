"""Quote Desk — carrier options on a load (S1, org-scoped).

Customer- and carrier-facing reps work the same load's options. Accepting
an option covers the load with that carrier + rate.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import joinedload

from app.deps import OrgScope, get_scope
from app.models import Carrier, Load, LoadOption
from app.schemas.load import LoadOut
from app.schemas.load_option import (
    OPTION_STATUSES,
    OptionCreate,
    OptionOut,
    OptionUpdate,
)

router = APIRouter(prefix="/api/loads", tags=["quote-desk"])


def _load(scope: OrgScope, load_id: int) -> Load:
    obj = scope.query(Load).filter(Load.id == load_id).first()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Load not found")
    return obj


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
    return (
        scope.query(LoadOption)
        .options(joinedload(LoadOption.carrier))
        .filter(LoadOption.load_id == load_id)
        .order_by(LoadOption.rate.asc().nulls_last(), LoadOption.created_at)
        .all()
    )


@router.post("/{load_id}/options", response_model=OptionOut, status_code=status.HTTP_201_CREATED)
def add_option(load_id: int, payload: OptionCreate, scope: OrgScope = Depends(get_scope)):
    _load(scope, load_id)
    _check_carrier(scope, payload.carrier_id)
    _validate_status(payload.status)
    opt = LoadOption(
        organization_id=scope.org_id,
        load_id=load_id,
        created_by=scope.user.id,
        **payload.model_dump(),
    )
    scope.db.add(opt)
    scope.db.commit()
    scope.db.refresh(opt)
    return opt


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

    load.carrier_id = opt.carrier_id
    load.carrier_rate = opt.counter_rate if opt.counter_rate is not None else opt.rate
    if load.status in ("quote", "tendered", "offered"):
        load.status = "covered"
    opt.status = "accepted"
    # Any other open option steps aside.
    for other in scope.query(LoadOption).filter(
        LoadOption.load_id == load_id, LoadOption.id != option_id, LoadOption.status == "available"
    ):
        other.status = "declined"
    scope.db.commit()

    refreshed = (
        scope.query(Load)
        .options(joinedload(Load.shipper), joinedload(Load.carrier), joinedload(Load.primary_contact))
        .filter(Load.id == load_id)
        .first()
    )
    return refreshed
