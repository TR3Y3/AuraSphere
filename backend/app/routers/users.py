"""Org-scoped user directory + teammate invites."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, status

from app import config
from app.deps import OrgScope, get_scope, require_role
from app.email import send_invite_email
from app.models import Organization, User
from app.routers.auth import issue_password_reset
from pydantic import BaseModel, Field

from app.schemas.auth import InviteRequest, InviteResult, UserOut
from app.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"admin", "member"}


@router.get("", response_model=list[UserOut])
def list_users(scope: OrgScope = Depends(get_scope)):
    return scope.query(User).order_by(User.full_name).all()


@router.post("/invite", response_model=InviteResult, status_code=status.HTTP_201_CREATED)
def invite_user(
    payload: InviteRequest,
    scope: OrgScope = Depends(get_scope),
    _: User = Depends(require_role("owner", "admin")),
):
    """Invite a teammate into the caller's org; they set their own password."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"role must be one of {', '.join(sorted(VALID_ROLES))}")
    email = payload.email.lower()
    if scope.db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="A user with this email already exists")

    user = User(
        organization_id=scope.org_id,
        email=email,
        # Unusable random password until they accept the invite and set one.
        password_hash=hash_password(secrets.token_urlsafe(32)),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    scope.db.add(user)
    scope.db.flush()

    invite_url = issue_password_reset(scope.db, user)
    scope.db.commit()
    scope.db.refresh(user)

    org = scope.db.query(Organization).filter(Organization.id == scope.org_id).first()
    send_invite_email(user.email, org.name, scope.user.full_name, invite_url)
    exposed = invite_url if config.EMAIL_DELIVERY == "console" else None
    return InviteResult(user=user, invite_url=exposed)


class UserAdminUpdate(BaseModel):
    sales_code: str | None = Field(None, max_length=20)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    scope: OrgScope = Depends(get_scope),
    _: User = Depends(require_role("owner", "admin")),
):
    """Admin-editable rep settings (currently the sales # / rep code)."""
    user = scope.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "sales_code" in data:
        user.sales_code = (data["sales_code"] or "").strip().upper() or None
    scope.db.commit()
    scope.db.refresh(user)
    return user
