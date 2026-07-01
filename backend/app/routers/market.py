"""DAT market rates — spot rate lookup by lane + equipment (auth-gated)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status as http

from app import dat
from app.deps import OrgScope, get_scope
from app.models import Load
from app.schemas.market import MarketRateOut

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/rate", response_model=MarketRateOut)
def lookup_rate(
    origin: str = Query(..., min_length=1),
    dest: str = Query(..., min_length=1),
    equipment: str | None = None,
    miles: int | None = Query(None, ge=0),
    scope: OrgScope = Depends(get_scope),  # auth only; rates aren't org data
):
    """DAT spot rate for a lane (used by the Quote Desk / load pricing)."""
    return dat.market_rate(origin, dest, equipment, miles)


@router.get("/rate/load/{load_id}", response_model=MarketRateOut)
def load_market_rate(load_id: int, scope: OrgScope = Depends(get_scope)):
    """Market rate for a specific load, using its lane, equipment, and miles."""
    load = scope.query(Load).filter(Load.id == load_id).first()
    if load is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Load not found")
    origin = ", ".join(p for p in [load.origin_city, load.origin_state] if p) or "?"
    dest = ", ".join(p for p in [load.dest_city, load.dest_state] if p) or "?"
    return dat.market_rate(origin, dest, load.equipment, load.total_miles)
