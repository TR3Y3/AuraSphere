"""Org-wide Options board — every carrier option across every load, one place.

Quotes = customer-facing pricing workflow. Options = carrier-side coverage
opportunities. This board aggregates the latter so ops can work coverage
without opening loads one by one. Active = open status (available/countered),
not expired (OPTION_TTL_HOURS after creation), on a load still in its
coverage phase; everything else is inactive (expired/declined/accepted/
covered/cancelled).
"""
from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app import offers
from app.deps import OrgScope, get_scope
from app.models import Carrier, Load, LoadOption
from app.schemas.load_option import BoardOption

router = APIRouter(prefix="/api/options", tags=["options-board"])


def _row(scope: OrgScope, opt: LoadOption, load: Load, carrier: Carrier | None) -> BoardOption:
    rate = opt.counter_rate if opt.counter_rate is not None else opt.rate
    margin = (load.customer_rate - rate) if (load.customer_rate is not None and rate is not None) else None
    return BoardOption(
        id=opt.id,
        load_id=load.id,
        load_reference=load.reference,
        load_status=load.status,
        origin_city=load.origin_city, origin_state=load.origin_state,
        dest_city=load.dest_city, dest_state=load.dest_state,
        pickup_date=load.pickup_date, delivery_date=load.delivery_date,
        equipment=load.equipment,
        customer_rate=load.customer_rate,
        carrier_id=opt.carrier_id,
        carrier_name=(carrier.name if carrier else None) or opt.carrier_name,
        carrier_phone=carrier.phone if carrier else None,
        carrier_email=carrier.email if carrier else None,
        mc_number=opt.mc_number or (carrier.mc_number if carrier else None),
        source=opt.source,
        carrier_light=offers.carrier_light(scope.db, opt),
        rate=opt.rate,
        counter_rate=opt.counter_rate,
        margin=margin,
        status=opt.status,
        notes=opt.notes,
        created_at=opt.created_at,
        expires_at=offers.option_expires_at(opt),
        is_expired=offers.option_is_expired(opt),
        active=offers.option_is_active(opt, load),
    )


@router.get("", response_model=list[BoardOption])
def list_board_options(
    scope: OrgScope = Depends(get_scope),
    view: str = "active",           # active | inactive | all
    search: str | None = None,      # lane / carrier / load ref / MC
    limit: int = 300,
):
    q = (
        scope.query(LoadOption)
        .join(Load, LoadOption.load_id == Load.id)
        .outerjoin(Carrier, LoadOption.carrier_id == Carrier.id)
        .options(joinedload(LoadOption.carrier))
    )
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            LoadOption.carrier_name.ilike(like),
            Carrier.name.ilike(like),
            LoadOption.mc_number.ilike(like),
            Carrier.mc_number.ilike(like),
            Load.reference.ilike(like),
            Load.origin_city.ilike(like),
            Load.dest_city.ilike(like),
        ))
    # Recent first at the SQL level; classification + final sort in Python
    # (expiry and "active" are derived, not stored).
    opts = q.order_by(LoadOption.created_at.desc()).limit(1000).all()
    load_ids = {o.load_id for o in opts}
    loads = {
        ld.id: ld
        for ld in scope.query(Load).filter(Load.id.in_(load_ids)).all()
    } if load_ids else {}

    rows: list[BoardOption] = []
    for opt in opts:
        load = loads.get(opt.load_id)
        if load is None:
            continue
        row = _row(scope, opt, load, opt.carrier)
        if view == "active" and not row.active:
            continue
        if view == "inactive" and row.active:
            continue
        rows.append(row)

    # Active: most urgent (closest to expiry) first. Inactive: newest first.
    rows.sort(key=lambda r: r.expires_at, reverse=(view != "active"))
    return rows[:limit]
