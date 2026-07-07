"""Companies CRUD — the reference vertical slice (org-scoped)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_

from app.deps import OrgScope, get_scope
from app.models import Company
from app.schemas.common import Page
from app.schemas.company import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter(prefix="/api/companies", tags=["companies"])

SORT_FIELDS = {
    "name": Company.name,
    "created_at": Company.created_at,
    "updated_at": Company.updated_at,
}


def _get_owned(scope: OrgScope, company_id: int) -> Company:
    company = scope.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return company


@router.get("", response_model=Page[CompanyOut])
def list_companies(
    scope: OrgScope = Depends(get_scope),
    search: str | None = None,
    owner_id: int | None = None,
    industry: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
):
    q = scope.query(Company)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                Company.name.ilike(like),
                Company.domain.ilike(like),
                Company.industry.ilike(like),
            )
        )
    if owner_id is not None:
        # "My records" / rep filter: a rep covers accounts they own primarily
        # OR back up as secondary.
        q = q.filter(or_(Company.owner_id == owner_id,
                         Company.secondary_owner_id == owner_id))
    if industry:
        q = q.filter(Company.industry.ilike(f"%{industry}%"))

    total = q.count()
    sort_col = SORT_FIELDS.get(sort, Company.created_at)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, scope: OrgScope = Depends(get_scope)):
    company = Company(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=payload.owner_id or scope.user.id,
        **payload.model_dump(exclude={"owner_id"}),
    )
    scope.db.add(company)
    scope.db.commit()
    scope.db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: int, scope: OrgScope = Depends(get_scope)):
    return _get_owned(scope, company_id)


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int, payload: CompanyUpdate, scope: OrgScope = Depends(get_scope)
):
    company = _get_owned(scope, company_id)
    if not scope.can_edit(company):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted"
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    scope.db.commit()
    scope.db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: int, scope: OrgScope = Depends(get_scope)):
    company = _get_owned(scope, company_id)
    if not scope.can_edit(company):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted"
        )
    scope.db.delete(company)
    scope.db.commit()
