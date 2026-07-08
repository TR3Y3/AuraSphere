"""Load tracking — check-calls / pings + status auto-advance hook (F6).

A check-call records the truck's location, an ETA, and a status note as the
load moves. Logging one can optionally advance the load's status (e.g. an
"At delivery" call that flips the load to `delivered`).
"""
from fastapi import APIRouter, Depends, HTTPException, status as http

from app.deps import OrgScope, get_scope
from app.models import CheckCall, Load
from app import events
from app.routers.loads import _apply_status
from app.schemas.check_call import CheckCallCreate, CheckCallOut

router = APIRouter(prefix="/api/loads/{load_id}/checkcalls", tags=["tracking"])


def _require_load(scope: OrgScope, load_id: int) -> Load:
    load = scope.query(Load).filter(Load.id == load_id).first()
    if load is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Load not found")
    return load


@router.get("", response_model=list[CheckCallOut])
def list_check_calls(load_id: int, scope: OrgScope = Depends(get_scope)):
    """Newest first — the latest ping is the truck's current position."""
    _require_load(scope, load_id)
    return (
        scope.query(CheckCall)
        .filter(CheckCall.load_id == load_id)
        .order_by(CheckCall.reported_at.desc(), CheckCall.id.desc())
        .all()
    )


@router.post("", response_model=CheckCallOut, status_code=http.HTTP_201_CREATED)
def create_check_call(
    load_id: int, payload: CheckCallCreate, scope: OrgScope = Depends(get_scope)
):
    load = _require_load(scope, load_id)
    if not scope.can_edit(load):
        raise HTTPException(status_code=http.HTTP_403_FORBIDDEN, detail="Not permitted")

    data = payload.model_dump(exclude={"advance_status"})
    cc = CheckCall(
        organization_id=scope.org_id,
        load_id=load_id,
        created_by=scope.user.id,
        **data,
    )
    scope.db.add(cc)

    # Tracking hook: optionally advance the load's status with the ping.
    if payload.advance_status is not None:
        old_status = load.status
        _apply_status(load, payload.advance_status)  # validates → 422
        events.log_status_change(scope.db, load, old_status, load.status, scope.user.id)

    scope.db.commit()
    scope.db.refresh(cc)
    return cc


@router.delete("/{call_id}", status_code=http.HTTP_204_NO_CONTENT)
def delete_check_call(load_id: int, call_id: int, scope: OrgScope = Depends(get_scope)):
    _require_load(scope, load_id)
    cc = (
        scope.query(CheckCall)
        .filter(CheckCall.id == call_id, CheckCall.load_id == load_id)
        .first()
    )
    if cc is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Check-call not found")
    scope.db.delete(cc)
    scope.db.commit()
