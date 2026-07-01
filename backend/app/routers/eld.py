"""ELD sync — pull the truck's current GPS location as a check-call (feeds F6)."""
from fastapi import APIRouter, Depends, HTTPException, status as http

from app import eld
from app.deps import OrgScope, get_scope
from app.models import CheckCall, Load
from app.schemas.check_call import CheckCallOut

router = APIRouter(prefix="/api/loads/{load_id}/eld", tags=["eld"])


def _require_load(scope: OrgScope, load_id: int) -> Load:
    load = scope.query(Load).filter(Load.id == load_id).first()
    if load is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Load not found")
    return load


@router.get("/status")
def eld_status(load_id: int, scope: OrgScope = Depends(get_scope)):
    _require_load(scope, load_id)
    return {"connected": eld.is_connected(), "provider": "samsara" if eld.is_connected() else "demo"}


@router.post("/sync", response_model=CheckCallOut, status_code=http.HTTP_201_CREATED)
def sync_eld(load_id: int, scope: OrgScope = Depends(get_scope)):
    """Poll the ELD for the truck's current position and log it as a check-call."""
    load = _require_load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")

    # Progress advances with how many pings we already have on this load.
    existing = scope.query(CheckCall).filter(CheckCall.load_id == load_id).count()
    ping = eld.poll_location(load, existing)
    if ping is None:
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="ELD could not locate this truck")

    cc = CheckCall(
        organization_id=scope.org_id,
        load_id=load_id,
        created_by=scope.user.id,
        **ping,
    )
    scope.db.add(cc)
    scope.db.commit()
    scope.db.refresh(cc)
    return cc
