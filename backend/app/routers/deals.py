"""Deals CRUD + kanban stage-change endpoint (Phase 3, org-scoped)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import joinedload

from app.defaults import ensure_default_pipeline
from app.deps import OrgScope, get_scope
from app.models import Company, Contact, Deal, Stage
from app.schemas.common import Page
from app.schemas.deal import DealCreate, DealOut, DealStageUpdate, DealUpdate

router = APIRouter(prefix="/api/deals", tags=["deals"])

SORT_FIELDS = {
    "name": Deal.name,
    "amount": Deal.amount,
    "created_at": Deal.created_at,
    "updated_at": Deal.updated_at,
    "expected_close_date": Deal.expected_close_date,
}


def _load(scope: OrgScope, deal_id: int) -> Deal:
    deal = (
        scope.query(Deal)
        .options(joinedload(Deal.company), joinedload(Deal.primary_contact))
        .filter(Deal.id == deal_id)
        .first()
    )
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return deal


def _stage_in_pipeline(scope: OrgScope, stage_id: int, pipeline_id: int) -> Stage:
    stage = (
        scope.query(Stage)
        .filter(Stage.id == stage_id, Stage.pipeline_id == pipeline_id)
        .first()
    )
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="stage_id is not a stage in this deal's pipeline",
        )
    return stage


def _validate_links(scope: OrgScope, company_id: int | None, contact_id: int | None) -> None:
    if company_id is not None and (
        scope.query(Company).filter(Company.id == company_id).first() is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="company_id does not reference a company in your organization",
        )
    if contact_id is not None and (
        scope.query(Contact).filter(Contact.id == contact_id).first() is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="primary_contact_id does not reference a contact in your organization",
        )


def _apply_closed_at(deal: Deal, stage: Stage) -> None:
    """Stamp closed_at when entering a won/lost stage; clear it otherwise."""
    if stage.is_won or stage.is_lost:
        if deal.closed_at is None:
            deal.closed_at = datetime.now(timezone.utc)
    else:
        deal.closed_at = None


@router.get("", response_model=Page[DealOut])
def list_deals(
    scope: OrgScope = Depends(get_scope),
    search: str | None = None,
    pipeline_id: int | None = None,
    stage_id: int | None = None,
    owner_id: int | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
):
    q = scope.query(Deal).options(
        joinedload(Deal.company), joinedload(Deal.primary_contact)
    )
    if search:
        q = q.filter(Deal.name.ilike(f"%{search}%"))
    if pipeline_id is not None:
        q = q.filter(Deal.pipeline_id == pipeline_id)
    if stage_id is not None:
        q = q.filter(Deal.stage_id == stage_id)
    if owner_id is not None:
        q = q.filter(Deal.owner_id == owner_id)

    total = q.count()
    sort_col = SORT_FIELDS.get(sort, Deal.created_at)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
def create_deal(payload: DealCreate, scope: OrgScope = Depends(get_scope)):
    pipeline = ensure_default_pipeline(scope.db, scope.org_id)
    pipeline_id = payload.pipeline_id or pipeline.id

    # Default to the first stage of the pipeline when none is given.
    if payload.stage_id is not None:
        stage = _stage_in_pipeline(scope, payload.stage_id, pipeline_id)
    else:
        stage = (
            scope.query(Stage)
            .filter(Stage.pipeline_id == pipeline_id)
            .order_by(Stage.sort_order)
            .first()
        )
        if stage is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="pipeline has no stages",
            )
    _validate_links(scope, payload.company_id, payload.primary_contact_id)

    deal = Deal(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=payload.owner_id or scope.user.id,
        pipeline_id=pipeline_id,
        stage_id=stage.id,
        name=payload.name,
        amount=payload.amount,
        company_id=payload.company_id,
        primary_contact_id=payload.primary_contact_id,
        expected_close_date=payload.expected_close_date,
    )
    _apply_closed_at(deal, stage)
    scope.db.add(deal)
    scope.db.commit()
    scope.db.refresh(deal)
    return deal


@router.get("/{deal_id}", response_model=DealOut)
def get_deal(deal_id: int, scope: OrgScope = Depends(get_scope)):
    return _load(scope, deal_id)


@router.patch("/{deal_id}", response_model=DealOut)
def update_deal(deal_id: int, payload: DealUpdate, scope: OrgScope = Depends(get_scope)):
    deal = _load(scope, deal_id)
    if not scope.can_edit(deal):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")

    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data or "primary_contact_id" in data:
        _validate_links(
            scope,
            data.get("company_id", deal.company_id),
            data.get("primary_contact_id", deal.primary_contact_id),
        )
    if "stage_id" in data and data["stage_id"] is not None:
        stage = _stage_in_pipeline(scope, data["stage_id"], deal.pipeline_id)
        deal.stage_id = stage.id
        _apply_closed_at(deal, stage)
        data.pop("stage_id")

    for field, value in data.items():
        setattr(deal, field, value)
    scope.db.commit()
    scope.db.refresh(deal)
    return deal


@router.patch("/{deal_id}/stage", response_model=DealOut)
def change_stage(
    deal_id: int, payload: DealStageUpdate, scope: OrgScope = Depends(get_scope)
):
    """Kanban drag target: move a deal to another stage in its pipeline."""
    deal = _load(scope, deal_id)
    if not scope.can_edit(deal):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    stage = _stage_in_pipeline(scope, payload.stage_id, deal.pipeline_id)
    deal.stage_id = stage.id
    _apply_closed_at(deal, stage)
    scope.db.commit()
    scope.db.refresh(deal)
    return deal


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: int, scope: OrgScope = Depends(get_scope)):
    deal = _load(scope, deal_id)
    if not scope.can_edit(deal):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    scope.db.delete(deal)
    scope.db.commit()
