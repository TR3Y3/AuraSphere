"""Auth + tenant-scoping dependencies.

`get_current_user` resolves the caller from the session cookie. `get_scope`
builds an `OrgScope` whose `.query(Model)` is pre-filtered to the caller's
organization, so a query can never accidentally span tenants. Never accept an
organization id from the client — it always comes from the resolved session.
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Query, Session as DbSession

from app import config
from app.database import get_db
from app.models import Session as SessionModel, User
from app.security import hash_token


def get_current_user(
    request: Request, db: DbSession = Depends(get_db)
) -> User:
    token = request.cookies.get(config.SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    session = (
        db.query(SessionModel)
        .filter(SessionModel.token_hash == hash_token(token))
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session"
        )

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired"
        )

    user = db.query(User).filter(User.id == session.user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user"
        )
    return user


class OrgScope:
    """Tenant-scoped data access for the current request."""

    def __init__(self, db: DbSession, user: User):
        self.db = db
        self.user = user
        self.org_id = user.organization_id

    def query(self, model) -> Query:
        """A query already filtered to the caller's organization."""
        return self.db.query(model).filter(model.organization_id == self.org_id)

    @property
    def is_admin(self) -> bool:
        return self.user.role in ("owner", "admin")


def get_scope(
    db: DbSession = Depends(get_db), user: User = Depends(get_current_user)
) -> OrgScope:
    return OrgScope(db, user)


def require_role(*roles: str):
    """Dependency factory enforcing the caller holds one of the given roles."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return checker
