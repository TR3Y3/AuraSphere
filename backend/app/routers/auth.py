"""Authentication endpoints: login, logout, current identity."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session as DbSession

from app import config
from app.database import get_db
from app.deps import get_current_user
from app.models import Organization, Session as SessionModel, User
from app.schemas.auth import LoginRequest, MeOut
from app.security import (
    generate_session_token,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        max_age=config.SESSION_TTL_HOURS * 3600,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        domain=config.COOKIE_DOMAIN,
        path="/",
    )


@router.post("/login", response_model=MeOut)
def login(
    payload: LoginRequest,
    response: Response,
    db: DbSession = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Verify even when the user is missing to keep timing uniform.
    valid = user is not None and verify_password(payload.password, user.password_hash)
    if not user or not valid or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = generate_session_token()
    db.add(
        SessionModel(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=config.SESSION_TTL_HOURS),
        )
    )
    db.commit()

    _set_session_cookie(response, token)
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return MeOut(user=user, organization=org)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession = Depends(get_db)):
    token = request.cookies.get(config.SESSION_COOKIE_NAME)
    if token:
        db.query(SessionModel).filter(
            SessionModel.token_hash == hash_token(token)
        ).delete()
        db.commit()
    response.delete_cookie(
        key=config.SESSION_COOKIE_NAME,
        domain=config.COOKIE_DOMAIN,
        path="/",
    )


@router.get("/me", response_model=MeOut)
def me(db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return MeOut(user=user, organization=org)
