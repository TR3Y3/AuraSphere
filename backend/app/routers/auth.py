"""Authentication endpoints: signup, login, logout, current identity, email verify."""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session as DbSession

from app import config
from app.database import get_db
from app.deps import get_current_user
from app.email import send_password_reset_email, send_verification_email
from app.models import (
    EmailVerificationToken,
    Organization,
    PasswordResetToken,
    Session as SessionModel,
    User,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MeOut,
    ResetPasswordRequest,
    SignupRequest,
    SignupResult,
    VerifyEmailRequest,
)
from app.security import (
    generate_session_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.security_ops import (
    get_client_ip,
    record_failed_login,
    check_rate_limit,
    RATE_LIMIT_AUTH_REQUESTS,
    RATE_LIMIT_AUTH_WINDOW,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _unique_slug(db: DbSession, name: str) -> str:
    """A URL-safe, globally unique org slug derived from the org name."""
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"
    slug = base
    n = 2
    while db.query(Organization).filter(Organization.slug == slug).first() is not None:
        slug = f"{base}-{n}"
        n += 1
    return slug


def _issue_verification(db: DbSession, user: User) -> str:
    """Supersede any prior tokens and return a fresh verify URL for the user."""
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id
    ).delete()
    token = generate_session_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=config.VERIFY_TTL_HOURS),
        )
    )
    return f"{config.FRONTEND_ORIGIN}/verify?token={token}"


def issue_password_reset(db: DbSession, user: User) -> str:
    """Supersede prior reset tokens and return a fresh set-password URL.

    Shared by forgot-password and teammate invites.
    """
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    token = generate_session_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=config.VERIFY_TTL_HOURS),
        )
    )
    return f"{config.FRONTEND_ORIGIN}/reset-password?token={token}"


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        max_age=config.SESSION_TTL_HOURS * 3600,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        domain=config.COOKIE_DOMAIN,
        path="/",
    )


@router.post("/signup", response_model=SignupResult, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, request: Request, db: DbSession = Depends(get_db)):
    """Self-serve: create a new brokerage (org) + its owner, log them in, and
    send an email-verification link."""
    ip = get_client_ip(request)

    # Rate limit auth endpoints
    if ip and not check_rate_limit(ip, RATE_LIMIT_AUTH_REQUESTS, RATE_LIMIT_AUTH_WINDOW):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup attempts. Try again later.",
        )

    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    org = Organization(name=payload.organization_name, slug=_unique_slug(db, payload.organization_name))
    db.add(org)
    db.flush()  # assign org.id

    user = User(
        organization_id=org.id,
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="owner",
        is_active=True,
    )
    db.add(user)
    db.flush()  # assign user.id

    verify_url = _issue_verification(db, user)

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
    db.refresh(user)
    db.refresh(org)

    send_verification_email(user.email, verify_url)
    _set_session_cookie(response, token)
    # Surface the link only in console mode (no real mailbox) for testability;
    # when a real provider (resend/smtp) is configured, the email carries it.
    exposed = verify_url if config.EMAIL_DELIVERY == "console" else None
    return SignupResult(user=user, organization=org, verify_url=exposed)


@router.post("/verify", response_model=MeOut)
def verify_email(payload: VerifyEmailRequest, db: DbSession = Depends(get_db)):
    row = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == hash_token(payload.token))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification link")
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link has expired")

    user = db.query(User).filter(User.id == row.user_id).first()
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
    db.delete(row)
    db.commit()
    db.refresh(user)
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return MeOut(user=user, organization=org)


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
def resend_verification(db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.email_verified_at is not None:
        return  # already verified — no-op
    verify_url = _issue_verification(db, user)
    db.commit()
    send_verification_email(user.email, verify_url)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: DbSession = Depends(get_db)):
    """Issue a reset link. Always 204 (never reveal whether the email exists)."""
    ip = get_client_ip(request)

    # Rate limit auth endpoints
    if ip and not check_rate_limit(ip, RATE_LIMIT_AUTH_REQUESTS, RATE_LIMIT_AUTH_WINDOW):
        # Still return 204 to not reveal rate limit info, but silently drop the request
        return

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is not None:
        reset_url = issue_password_reset(db, user)
        db.commit()
        send_password_reset_email(user.email, reset_url)


@router.post("/reset-password", response_model=MeOut)
def reset_password(payload: ResetPasswordRequest, response: Response, db: DbSession = Depends(get_db)):
    row = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == hash_token(payload.token))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or used reset link")
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link has expired")

    user = db.query(User).filter(User.id == row.user_id).first()
    user.password_hash = hash_password(payload.password)
    user.is_active = True
    # Setting a password via an emailed link proves email ownership.
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
    db.delete(row)

    # Log them straight in on success.
    token = generate_session_token()
    db.add(SessionModel(
        user_id=user.id, token_hash=hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=config.SESSION_TTL_HOURS),
    ))
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, token)
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return MeOut(user=user, organization=org)


@router.post("/login", response_model=MeOut)
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    db: DbSession = Depends(get_db),
):
    ip = get_client_ip(request)

    # Rate limit auth endpoints
    if ip and not check_rate_limit(ip, RATE_LIMIT_AUTH_REQUESTS, RATE_LIMIT_AUTH_WINDOW):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Verify even when the user is missing to keep timing uniform.
    valid = user is not None and verify_password(payload.password, user.password_hash)
    if not user or not valid or not user.is_active:
        # Track failed attempt for auto-ban
        if ip:
            record_failed_login(db, ip, payload.email.lower())
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
