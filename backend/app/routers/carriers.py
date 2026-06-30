"""Carriers CRUD (freight pivot, F1) — org-scoped, same pattern as shippers."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_

from app.deps import OrgScope, get_scope
from app.models import Carrier
from app.schemas.carrier import CarrierCreate, CarrierOut, CarrierUpdate
from app.schemas.common import Page

router = APIRouter(prefix="/api/carriers", tags=["carriers"])

SORT_FIELDS = {
    "name": Carrier.name,
    "rating": Carrier.rating,
    "created_at": Carrier.created_at,
    "updated_at": Carrier.updated_at,
}


def _get_owned(scope: OrgScope, carrier_id: int) -> Carrier:
    carrier = scope.query(Carrier).filter(Carrier.id == carrier_id).first()
    if carrier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return carrier


@router.get("", response_model=Page[CarrierOut])
def list_carriers(
    scope: OrgScope = Depends(get_scope),
    search: str | None = None,
    owner_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
):
    q = scope.query(Carrier)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                Carrier.name.ilike(like),
                Carrier.mc_number.ilike(like),
                Carrier.dot_number.ilike(like),
            )
        )
    if owner_id is not None:
        q = q.filter(Carrier.owner_id == owner_id)
    if status_filter:
        q = q.filter(Carrier.status == status_filter)

    total = q.count()
    sort_col = SORT_FIELDS.get(sort, Carrier.created_at)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CarrierOut, status_code=status.HTTP_201_CREATED)
def create_carrier(payload: CarrierCreate, scope: OrgScope = Depends(get_scope)):
    carrier = Carrier(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=payload.owner_id or scope.user.id,
        **payload.model_dump(exclude={"owner_id"}),
    )
    scope.db.add(carrier)
    scope.db.commit()
    scope.db.refresh(carrier)
    return carrier


@router.get("/{carrier_id}", response_model=CarrierOut)
def get_carrier(carrier_id: int, scope: OrgScope = Depends(get_scope)):
    return _get_owned(scope, carrier_id)


@router.patch("/{carrier_id}", response_model=CarrierOut)
def update_carrier(
    carrier_id: int, payload: CarrierUpdate, scope: OrgScope = Depends(get_scope)
):
    carrier = _get_owned(scope, carrier_id)
    if not scope.can_edit(carrier):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(carrier, field, value)
    scope.db.commit()
    scope.db.refresh(carrier)
    return carrier


@router.delete("/{carrier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carrier(carrier_id: int, scope: OrgScope = Depends(get_scope)):
    carrier = _get_owned(scope, carrier_id)
    if not scope.can_edit(carrier):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    scope.db.delete(carrier)
    scope.db.commit()
