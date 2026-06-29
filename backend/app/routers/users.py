"""Org-scoped user directory (for owner selection / reassignment UIs)."""
from fastapi import APIRouter, Depends

from app.deps import OrgScope, get_scope
from app.models import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(scope: OrgScope = Depends(get_scope)):
    return scope.query(User).order_by(User.full_name).all()
