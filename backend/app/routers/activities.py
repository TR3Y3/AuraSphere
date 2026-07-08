"""Activities + timeline (F4, org-scoped).

Log calls/emails/notes/tasks against any record (load/carrier/shipper/
contact). Tasks carry a due date and a completion stamp; "My open tasks"
is just a filtered list.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import OrgScope, get_scope
from app.models import Activity, Carrier, Company, Contact, Load, User
from app.schemas.activity import (
    ACTIVITY_TYPES,
    ActivityCreate,
    ActivityOut,
    ActivityUpdate,
    MentionCount,
)
from app.schemas.common import Page

router = APIRouter(prefix="/api/activities", tags=["activities"])

LINK_MODELS = {
    "related_contact_id": Contact,
    "related_company_id": Company,
    "related_load_id": Load,
    "related_carrier_id": Carrier,
}


def _validate_links(scope: OrgScope, data: dict) -> None:
    """Every related_* id must point at an in-org record."""
    for field, model in LINK_MODELS.items():
        rid = data.get(field)
        if rid is not None and scope.query(model).filter(model.id == rid).first() is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"{field} does not reference a record in your organization")


def _get(scope: OrgScope, activity_id: int) -> Activity:
    a = scope.query(Activity).filter(Activity.id == activity_id).first()
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return a


@router.get("", response_model=Page[ActivityOut])
def list_activities(
    scope: OrgScope = Depends(get_scope),
    type: str | None = None,
    owner_id: int | None = None,
    related_contact_id: int | None = None,
    related_company_id: int | None = None,
    related_load_id: int | None = None,
    related_carrier_id: int | None = None,
    open_tasks: bool = False,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    q = scope.query(Activity)
    if type:
        q = q.filter(Activity.type == type)
    if owner_id is not None:
        q = q.filter(Activity.owner_id == owner_id)
    if related_contact_id is not None:
        q = q.filter(Activity.related_contact_id == related_contact_id)
    if related_company_id is not None:
        q = q.filter(Activity.related_company_id == related_company_id)
    if related_load_id is not None:
        q = q.filter(Activity.related_load_id == related_load_id)
    if related_carrier_id is not None:
        q = q.filter(Activity.related_carrier_id == related_carrier_id)
    if open_tasks:
        q = q.filter(Activity.type == "task", Activity.completed_at.is_(None))

    total = q.count()
    # Open-task views read better by soonest due date.
    sort_col = Activity.due_at if (open_tasks or sort == "due_at") else Activity.created_at
    q = q.order_by(sort_col.asc() if (order == "asc" or open_tasks) else sort_col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/mentions/unseen", response_model=Page[ActivityOut])
def unseen_mentions(scope: OrgScope = Depends(get_scope)):
    """Activities that @mention me, created after my last mark-seen."""
    q = scope.query(Activity).filter(Activity.mentions.isnot(None))
    if scope.user.mentions_seen_at is not None:
        q = q.filter(Activity.created_at > scope.user.mentions_seen_at)
    # JSON-list containment is dialect-specific; volumes are small, filter here.
    rows = [a for a in q.order_by(Activity.created_at.desc()).limit(50).all()
            if scope.user.id in (a.mentions or [])]
    return Page(items=rows[:20], total=len(rows), page=1, page_size=20)


@router.post("/mentions/seen", response_model=MentionCount)
def mark_mentions_seen(scope: OrgScope = Depends(get_scope)):
    scope.user.mentions_seen_at = datetime.now(timezone.utc)
    scope.db.commit()
    return MentionCount(count=0)


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityCreate, scope: OrgScope = Depends(get_scope)):
    if payload.type not in ACTIVITY_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"type must be one of {', '.join(ACTIVITY_TYPES)}")
    data = payload.model_dump(exclude={"owner_id"})
    _validate_links(scope, data)
    if data.get("mentions"):
        in_org = {u.id for u in scope.query(User).filter(User.id.in_(data["mentions"])).all()}
        if set(data["mentions"]) - in_org:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="mentions must be user ids in your organization")
    activity = Activity(
        organization_id=scope.org_id,
        owner_id=payload.owner_id or scope.user.id,
        **data,
    )
    scope.db.add(activity)
    scope.db.commit()
    scope.db.refresh(activity)
    return activity


@router.patch("/{activity_id}", response_model=ActivityOut)
def update_activity(activity_id: int, payload: ActivityUpdate, scope: OrgScope = Depends(get_scope)):
    activity = _get(scope, activity_id)
    if activity.kind == "system":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="System feed entries are read-only")
    if not scope.can_edit(activity):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    data = payload.model_dump(exclude_unset=True)
    _validate_links(scope, data)
    if "completed" in data:
        completed = data.pop("completed")
        activity.completed_at = datetime.now(timezone.utc) if completed else None
    for field, value in data.items():
        setattr(activity, field, value)
    scope.db.commit()
    scope.db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: int, scope: OrgScope = Depends(get_scope)):
    activity = _get(scope, activity_id)
    if activity.kind == "system":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="System feed entries are read-only")
    if not scope.can_edit(activity):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    scope.db.delete(activity)
    scope.db.commit()
