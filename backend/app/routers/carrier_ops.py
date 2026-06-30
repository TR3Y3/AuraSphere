"""Carrier ops — derived lane history + posted capacity (F3, org-scoped).

Lane history is computed from the carrier's loads (no separate table), so it
is always accurate. Capacity is manually posted per location.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import OrgScope, get_scope
from app.models import Carrier, CarrierCapacity, Load
from app.schemas.carrier_ops import CapacityCreate, CapacityOut, LaneOut

router = APIRouter(prefix="/api/carriers", tags=["carrier-ops"])


def _carrier(scope: OrgScope, carrier_id: int) -> Carrier:
    c = scope.query(Carrier).filter(Carrier.id == carrier_id).first()
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carrier not found")
    return c


def _loc(city: str | None, st: str | None) -> str:
    return ", ".join(p for p in [city, st] if p) or "—"


@router.get("/{carrier_id}/lanes", response_model=list[LaneOut])
def carrier_lanes(carrier_id: int, scope: OrgScope = Depends(get_scope)):
    """Aggregate the carrier's loads into lane history (most-run first)."""
    _carrier(scope, carrier_id)
    loads = (
        scope.query(Load)
        .filter(Load.carrier_id == carrier_id)
        .order_by(Load.id.desc())  # id is monotonic → deterministic "most recent"
        .all()
    )
    lanes: dict[tuple, dict] = {}
    for ld in loads:
        origin = _loc(ld.origin_city, ld.origin_state)
        dest = _loc(ld.dest_city, ld.dest_state)
        key = (origin, dest, ld.equipment or "")
        agg = lanes.get(key)
        if agg is None:
            # loads are newest-first, so the first seen is the most recent.
            lanes[key] = {
                "origin": origin, "destination": dest, "equipment": ld.equipment,
                "shipments": 1, "last_rate": ld.carrier_rate, "last_ran": ld.created_at,
            }
        else:
            agg["shipments"] += 1
    return sorted(lanes.values(), key=lambda x: x["shipments"], reverse=True)


@router.get("/{carrier_id}/capacity", response_model=list[CapacityOut])
def list_capacity(carrier_id: int, scope: OrgScope = Depends(get_scope)):
    _carrier(scope, carrier_id)
    return (
        scope.query(CarrierCapacity)
        .filter(CarrierCapacity.carrier_id == carrier_id)
        .order_by(CarrierCapacity.created_at.desc())
        .all()
    )


@router.post("/{carrier_id}/capacity", response_model=CapacityOut, status_code=status.HTTP_201_CREATED)
def add_capacity(carrier_id: int, payload: CapacityCreate, scope: OrgScope = Depends(get_scope)):
    _carrier(scope, carrier_id)
    cap = CarrierCapacity(
        organization_id=scope.org_id,
        carrier_id=carrier_id,
        created_by=scope.user.id,
        **payload.model_dump(),
    )
    scope.db.add(cap)
    scope.db.commit()
    scope.db.refresh(cap)
    return cap


@router.delete("/{carrier_id}/capacity/{capacity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capacity(carrier_id: int, capacity_id: int, scope: OrgScope = Depends(get_scope)):
    cap = (
        scope.query(CarrierCapacity)
        .filter(CarrierCapacity.id == capacity_id, CarrierCapacity.carrier_id == carrier_id)
        .first()
    )
    if cap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    scope.db.delete(cap)
    scope.db.commit()
