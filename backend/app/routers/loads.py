"""Loads (shipments) CRUD + status-board endpoint (F2, org-scoped).

A quote is a load created with status `quote`. Margin is derived in the
schema (customer_rate − carrier_rate).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status as http
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app import dat, plans
from app.deps import OrgScope, get_scope
from app.models import Carrier, Company, Contact, Load, Organization
from app.schemas.common import Page
from app.schemas.load import LoadCreate, LoadOut, LoadStatusUpdate, LoadUpdate
from app.workflow import LOAD_PIPELINE, LOAD_STATUSES, is_valid_status

router = APIRouter(prefix="/api/loads", tags=["loads"])


def _enforce_load_limit(scope: OrgScope) -> None:
    """Free-plan load ceiling (402 when exceeded → prompt to upgrade)."""
    org = scope.db.query(Organization).filter(Organization.id == scope.org_id).first()
    limit = plans.max_loads(org.plan if org else "free")
    if limit is not None and scope.query(Load).count() >= limit:
        raise HTTPException(
            status_code=http.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Free plan is limited to {limit} loads. Upgrade to Pro for unlimited loads.",
        )

SORT_FIELDS = {
    "reference": Load.reference,
    "created_at": Load.created_at,
    "updated_at": Load.updated_at,
    "pickup_date": Load.pickup_date,
    "customer_rate": Load.customer_rate,
}


def _load(scope: OrgScope, load_id: int) -> Load:
    obj = (
        scope.query(Load)
        .options(
            joinedload(Load.shipper),
            joinedload(Load.carrier),
            joinedload(Load.primary_contact),
        )
        .filter(Load.id == load_id)
        .first()
    )
    if obj is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Not found")
    return obj


def _validate_links(scope: OrgScope, shipper_id, carrier_id, contact_id) -> None:
    if shipper_id is not None and (
        scope.query(Company).filter(Company.id == shipper_id).first() is None
    ):
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="shipper_id is not a shipper in your organization")
    if carrier_id is not None and (
        scope.query(Carrier).filter(Carrier.id == carrier_id).first() is None
    ):
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="carrier_id is not a carrier in your organization")
    if contact_id is not None and (
        scope.query(Contact).filter(Contact.id == contact_id).first() is None
    ):
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="primary_contact_id is not a contact in your organization")


def _apply_status(load: Load, status_value: str) -> None:
    if not is_valid_status(status_value):
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"invalid status (allowed: {', '.join(LOAD_STATUSES)})")
    load.status = status_value
    if status_value == "delivered" and load.delivered_at is None:
        load.delivered_at = datetime.now(timezone.utc)


@router.get("", response_model=Page[LoadOut])
def list_loads(
    scope: OrgScope = Depends(get_scope),
    search: str | None = None,
    status: str | None = None,
    statuses: str | None = Query(None, description="comma-separated status filter"),
    shipper_id: int | None = None,
    carrier_id: int | None = None,
    owner_id: int | None = None,
    equipment: str | None = None,
    origin_state: str | None = None,
    dest_state: str | None = None,
    posted_to_dat: bool | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=1000),
):
    q = scope.query(Load).options(
        joinedload(Load.shipper), joinedload(Load.carrier), joinedload(Load.primary_contact)
    )
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Load.reference.ilike(like),
            Load.commodity.ilike(like),
            Load.origin_city.ilike(like),
            Load.dest_city.ilike(like),
        ))
    if status:
        q = q.filter(Load.status == status)
    if statuses:
        wanted = [s.strip() for s in statuses.split(",") if s.strip()]
        if wanted:
            q = q.filter(Load.status.in_(wanted))
    if shipper_id is not None:
        q = q.filter(Load.shipper_id == shipper_id)
    if carrier_id is not None:
        q = q.filter(Load.carrier_id == carrier_id)
    if owner_id is not None:
        q = q.filter(Load.owner_id == owner_id)
    if equipment:
        q = q.filter(Load.equipment.ilike(f"%{equipment}%"))
    if origin_state:
        q = q.filter(Load.origin_state.ilike(origin_state))
    if dest_state:
        q = q.filter(Load.dest_state.ilike(dest_state))
    if posted_to_dat is not None:
        q = q.filter(Load.dat_posting_id.isnot(None) if posted_to_dat else Load.dat_posting_id.is_(None))

    total = q.count()
    sort_col = SORT_FIELDS.get(sort, Load.created_at)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=LoadOut, status_code=http.HTTP_201_CREATED)
def create_load(payload: LoadCreate, scope: OrgScope = Depends(get_scope)):
    _enforce_load_limit(scope)
    _validate_links(scope, payload.shipper_id, payload.carrier_id, payload.primary_contact_id)
    status_value = payload.status or "quote"
    if not is_valid_status(status_value):
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="invalid status")
    load = Load(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=payload.owner_id or scope.user.id,
        status=status_value,
        **payload.model_dump(exclude={"owner_id", "status", "post_to_dat"}),
    )
    scope.db.add(load)
    scope.db.flush()  # assign id for the reference
    load.reference = f"L-{100000 + load.id}"
    if payload.post_to_dat:
        load.dat_posting_id = dat.post_load(load)
        load.dat_posted_at = datetime.now(timezone.utc)
    scope.db.commit()
    scope.db.refresh(load)
    return load


@router.post("/{load_id}/dat-post", response_model=LoadOut)
def post_to_dat(load_id: int, scope: OrgScope = Depends(get_scope)):
    """Post the load to the DAT load board (idempotent)."""
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")
    if load.dat_posting_id is None:
        load.dat_posting_id = dat.post_load(load)
        load.dat_posted_at = datetime.now(timezone.utc)
        scope.db.commit()
        scope.db.refresh(load)
    return load


@router.delete("/{load_id}/dat-post", response_model=LoadOut)
def remove_dat_post(load_id: int, scope: OrgScope = Depends(get_scope)):
    """Remove the load's DAT posting."""
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")
    if load.dat_posting_id is not None:
        dat.remove_posting(load.dat_posting_id)
        load.dat_posting_id = None
        load.dat_posted_at = None
        scope.db.commit()
        scope.db.refresh(load)
    return load


@router.post("/{load_id}/duplicate", response_model=LoadOut, status_code=http.HTTP_201_CREATED)
def duplicate_load(load_id: int, scope: OrgScope = Depends(get_scope)):
    """Re-book: clone the load's lane/shipper/freight into a fresh quote
    (carrier + carrier rate dropped, status reset to quote)."""
    _enforce_load_limit(scope)
    src = _load(scope, load_id)
    clone = Load(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=scope.user.id,
        status="quote",
        shipper_id=src.shipper_id,
        primary_contact_id=src.primary_contact_id,
        commodity=src.commodity,
        weight=src.weight,
        equipment=src.equipment,
        origin_city=src.origin_city,
        origin_state=src.origin_state,
        dest_city=src.dest_city,
        dest_state=src.dest_state,
        total_miles=src.total_miles,
        customer_rate=src.customer_rate,
        target_rate=src.target_rate,
    )
    scope.db.add(clone)
    scope.db.flush()
    clone.reference = f"L-{100000 + clone.id}"
    scope.db.commit()
    scope.db.refresh(clone)
    return clone


@router.get("/board", response_model=dict)
def board_meta(scope: OrgScope = Depends(get_scope)):
    """The ordered pipeline statuses that make up the board columns."""
    return {"pipeline": LOAD_PIPELINE, "statuses": LOAD_STATUSES}


@router.get("/{load_id}", response_model=LoadOut)
def get_load(load_id: int, scope: OrgScope = Depends(get_scope)):
    return _load(scope, load_id)


@router.patch("/{load_id}", response_model=LoadOut)
def update_load(load_id: int, payload: LoadUpdate, scope: OrgScope = Depends(get_scope)):
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")
    data = payload.model_dump(exclude_unset=True)
    if any(k in data for k in ("shipper_id", "carrier_id", "primary_contact_id")):
        _validate_links(
            scope,
            data.get("shipper_id", load.shipper_id),
            data.get("carrier_id", load.carrier_id),
            data.get("primary_contact_id", load.primary_contact_id),
        )
    if "status" in data and data["status"] is not None:
        _apply_status(load, data.pop("status"))
    for field, value in data.items():
        setattr(load, field, value)
    scope.db.commit()
    scope.db.refresh(load)
    return load


@router.patch("/{load_id}/status", response_model=LoadOut)
def change_status(load_id: int, payload: LoadStatusUpdate, scope: OrgScope = Depends(get_scope)):
    """Board drag / action-row target: move a load to another status."""
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")
    _apply_status(load, payload.status)
    scope.db.commit()
    scope.db.refresh(load)
    return load


@router.delete("/{load_id}", status_code=http.HTTP_204_NO_CONTENT)
def delete_load(load_id: int, scope: OrgScope = Depends(get_scope)):
    load = _load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")
    scope.db.delete(load)
    scope.db.commit()
