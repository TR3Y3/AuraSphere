"""Security operations: rate limiting, IP bans, brute force protection."""
import logging
import os
import sys
from datetime import datetime, timedelta
from collections import defaultdict, deque
import threading

from sqlalchemy.orm import Session

from app.models import IPBan, FailedLoginAttempt

log = logging.getLogger("aurasphere")

# Skip security checks in test mode
IS_TEST_MODE = "pytest" in sys.modules or os.getenv("DATABASE_URL", "").startswith("sqlite")

# In-memory rate limiters (per-IP). In production, use Redis.
# Key: IP address, Value: deque of timestamps (last N requests)
_rate_limit_windows = defaultdict(deque)
_rate_limit_lock = threading.Lock()

# Configuration constants
RATE_LIMIT_REQUESTS = 100  # requests
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_AUTH_REQUESTS = 5  # login/signup/forgot-password attempts
RATE_LIMIT_AUTH_WINDOW = 300  # 5 minutes
FAILED_LOGIN_THRESHOLD = 5  # ban after N failed attempts
FAILED_LOGIN_WINDOW = 1800  # 30 minutes


def get_client_ip(request) -> str | None:
    """Extract client IP from request, respecting X-Forwarded-For behind proxy."""
    # X-Forwarded-For is set by Render/proxies; take the first (client) IP
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def is_ip_banned(db: Session, ip_address: str) -> bool:
    """Check if an IP is currently banned. Disabled in test mode."""
    if IS_TEST_MODE or not ip_address:
        return False
    ban = db.query(IPBan).filter(
        IPBan.ip_address == ip_address,
        IPBan.is_active == True,
        (IPBan.expires_at.is_(None) | (IPBan.expires_at > datetime.utcnow()))
    ).first()
    return ban is not None


def ban_ip(db: Session, ip_address: str, reason: str, auto_banned: bool = False, expires_in_hours: int | None = None):
    """Ban an IP address."""
    if not ip_address:
        return

    expires_at = None
    if expires_in_hours:
        expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    # Update if exists, create if not
    ban = db.query(IPBan).filter_by(ip_address=ip_address).first()
    if ban:
        ban.reason = reason
        ban.is_active = True
        ban.expires_at = expires_at
        ban.auto_banned = auto_banned
    else:
        ban = IPBan(
            ip_address=ip_address,
            reason=reason,
            is_active=True,
            auto_banned=auto_banned,
            expires_at=expires_at
        )
        db.add(ban)
    db.commit()
    log.warning(f"IP banned: {ip_address} ({reason})")


def unban_ip(db: Session, ip_address: str):
    """Unban an IP address."""
    ban = db.query(IPBan).filter_by(ip_address=ip_address).first()
    if ban:
        ban.is_active = False
        db.commit()
        log.info(f"IP unbanned: {ip_address}")


def check_rate_limit(ip_address: str, limit: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW) -> bool:
    """
    Check if IP has exceeded rate limit. Returns True if within limit, False if exceeded.
    Uses sliding window (in-memory). Disabled in test mode.
    """
    if IS_TEST_MODE or not ip_address:
        return True  # No IP = allow; skip checks in test mode

    now = datetime.utcnow().timestamp()
    cutoff = now - window

    with _rate_limit_lock:
        requests = _rate_limit_windows[ip_address]

        # Remove old requests outside the window
        while requests and requests[0] < cutoff:
            requests.popleft()

        if len(requests) >= limit:
            return False  # Rate limit exceeded

        # Add current request
        requests.append(now)
        return True


def record_failed_login(db: Session, ip_address: str, email: str | None = None):
    """Record a failed login attempt and check for auto-ban."""
    if not ip_address:
        return

    # Add the attempt
    attempt = FailedLoginAttempt(ip_address=ip_address, email=email)
    db.add(attempt)
    db.commit()

    # Check if we should auto-ban
    cutoff = datetime.utcnow() - timedelta(seconds=FAILED_LOGIN_WINDOW)
    recent_attempts = db.query(FailedLoginAttempt).filter(
        FailedLoginAttempt.ip_address == ip_address,
        FailedLoginAttempt.attempted_at >= cutoff
    ).count()

    if recent_attempts >= FAILED_LOGIN_THRESHOLD:
        ban_ip(
            db,
            ip_address,
            f"Auto-banned: {recent_attempts} failed login attempts",
            auto_banned=True,
            expires_in_hours=1  # 1 hour auto-ban
        )


def get_failed_login_count(db: Session, ip_address: str, window_seconds: int = FAILED_LOGIN_WINDOW) -> int:
    """Get count of failed logins for an IP in the past N seconds."""
    if not ip_address:
        return 0
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
    return db.query(FailedLoginAttempt).filter(
        FailedLoginAttempt.ip_address == ip_address,
        FailedLoginAttempt.attempted_at >= cutoff
    ).count()


def cleanup_expired_bans(db: Session):
    """Remove expired bans (called periodically)."""
    expired = db.query(IPBan).filter(
        IPBan.expires_at <= datetime.utcnow()
    ).delete()
    if expired:
        db.commit()
        log.info(f"Cleaned up {expired} expired IP bans")


def cleanup_old_failed_attempts(db: Session, older_than_hours: int = 24):
    """Clean up old failed login records to keep DB small."""
    cutoff = datetime.utcnow() - timedelta(hours=older_than_hours)
    deleted = db.query(FailedLoginAttempt).filter(
        FailedLoginAttempt.attempted_at < cutoff
    ).delete()
    if deleted:
        db.commit()
        log.debug(f"Cleaned up {deleted} old failed login attempts")
