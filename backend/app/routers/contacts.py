"""Contacts CRUD — mirrors the companies slice, adds company linking."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.deps import OrgScope, get_scope
from app.models import Company, Contact
from app.schemas.common import Page
from app.schemas.contact import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/api/contacts", tags=["contacts"])

SORT_FIELDS = {
    "first_name": Contact.first_name,
    "last_name": Contact.last_name,
    "created_at": Contact.created_at,
    "updated_at": Contact.updated_at,
}


def _get_owned(scope: OrgScope, contact_id: int) -> Contact:
    contact = (
        scope.query(Contact)
        .options(joinedload(Contact.company))
        .filter(Contact.id == contact_id)
        .first()
    )
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return contact


def _validate_company(scope: OrgScope, company_id: int | None) -> None:
    """A linked company must exist within the caller's organization."""
    if company_id is None:
        return
    exists = scope.query(Company).filter(Company.id == company_id).first()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="company_id does not reference a company in your organization",
        )


@router.get("", response_model=Page[ContactOut])
def list_contacts(
    scope: OrgScope = Depends(get_scope),
    search: str | None = None,
    owner_id: int | None = None,
    company_id: int | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
):
    q = scope.query(Contact).options(joinedload(Contact.company))
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                Contact.first_name.ilike(like),
                Contact.last_name.ilike(like),
                Contact.email.ilike(like),
            )
        )
    if owner_id is not None:
        q = q.filter(Contact.owner_id == owner_id)
    if company_id is not None:
        q = q.filter(Contact.company_id == company_id)

    total = q.count()
    sort_col = SORT_FIELDS.get(sort, Contact.created_at)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(payload: ContactCreate, scope: OrgScope = Depends(get_scope)):
    _validate_company(scope, payload.company_id)
    contact = Contact(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=payload.owner_id or scope.user.id,
        **payload.model_dump(exclude={"owner_id"}),
    )
    scope.db.add(contact)
    scope.db.commit()
    scope.db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: int, scope: OrgScope = Depends(get_scope)):
    return _get_owned(scope, contact_id)


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int, payload: ContactUpdate, scope: OrgScope = Depends(get_scope)
):
    contact = _get_owned(scope, contact_id)
    if not scope.can_edit(contact):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted"
        )
    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data:
        _validate_company(scope, data["company_id"])
    for field, value in data.items():
        setattr(contact, field, value)
    scope.db.commit()
    scope.db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, scope: OrgScope = Depends(get_scope)):
    contact = _get_owned(scope, contact_id)
    if not scope.can_edit(contact):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted"
        )
    scope.db.delete(contact)
    scope.db.commit()
