"""Org-scoped companies read endpoint (Phase 1 isolation slice).

Full CRUD arrives in Phase 2. This list is here so tenant isolation is
exercised by a real HTTP endpoint and its test.
"""
from fastapi import APIRouter, Depends

from app.deps import OrgScope, get_scope
from app.models import Company
from app.schemas.company import CompanyOut

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CompanyOut])
def list_companies(scope: OrgScope = Depends(get_scope)):
    return scope.query(Company).order_by(Company.id).all()
