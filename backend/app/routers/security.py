"""Admin security management: IP bans, failed login tracking."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models import User, IPBan, FailedLoginAttempt
from app.security_ops import (
    ban_ip,
    unban_ip,
    get_failed_login_count,
    cleanup_expired_bans,
    cleanup_old_failed_attempts,
)

router = APIRouter(prefix="/api/admin/security", tags=["security"])


# Schemas
class IPBanOut(BaseModel):
    id: int
    ip_address: str
    reason: Optional[str]
    is_active: bool
    auto_banned: bool
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class BanIPRequest(BaseModel):
    ip_address: str
    reason: str
    expires_in_hours: Optional[int] = None


class SecurityStatsOut(BaseModel):
    total_bans: int
    active_bans: int
    auto_banned: int
    failed_attempts_24h: int


# Endpoints

@router.get("/stats", response_model=SecurityStatsOut)
def get_security_stats(
    _: User = Depends(require_role("owner")),
    db: DbSession = Depends(get_db),
):
    """Get security statistics (owner-only)."""
    total_bans = db.query(IPBan).count()
    active_bans = db.query(IPBan).filter(
        IPBan.is_active == True,
        (IPBan.expires_at.is_(None) | (IPBan.expires_at > datetime.utcnow()))
    ).count()
    auto_banned = db.query(IPBan).filter(IPBan.auto_banned == True, IPBan.is_active == True).count()

    cutoff = datetime.utcnow() - timedelta(hours=24)
    failed_24h = db.query(FailedLoginAttempt).filter(
        FailedLoginAttempt.attempted_at >= cutoff
    ).count()

    return SecurityStatsOut(
        total_bans=total_bans,
        active_bans=active_bans,
        auto_banned=auto_banned,
        failed_attempts_24h=failed_24h,
    )


@router.get("/bans", response_model=list[IPBanOut])
def list_bans(
    active_only: bool = True,
    _: User = Depends(require_role("owner")),
    db: DbSession = Depends(get_db),
):
    """List IP bans (owner-only)."""
    query = db.query(IPBan)

    if active_only:
        query = query.filter(
            IPBan.is_active == True,
            (IPBan.expires_at.is_(None) | (IPBan.expires_at > datetime.utcnow()))
        )

    return query.order_by(IPBan.created_at.desc()).limit(100).all()


@router.post("/ban", response_model=IPBanOut)
def create_ban(
    payload: BanIPRequest,
    user: User = Depends(require_role("owner")),
    db: DbSession = Depends(get_db),
):
    """Manually ban an IP address (owner-only)."""
    ban_ip(
        db,
        payload.ip_address,
        payload.reason,
        auto_banned=False,
        expires_in_hours=payload.expires_in_hours,
    )
    return db.query(IPBan).filter_by(ip_address=payload.ip_address).first()


@router.post("/unban/{ip_address}")
def unban(
    ip_address: str,
    _: User = Depends(require_role("owner")),
    db: DbSession = Depends(get_db),
):
    """Unban an IP address (owner-only)."""
    unban_ip(db, ip_address)
    return {"detail": f"IP {ip_address} unbanned"}


@router.get("/failed-attempts")
def list_failed_attempts(
    limit: int = 50,
    _: User = Depends(require_role("owner")),
    db: DbSession = Depends(get_db),
):
    """List recent failed login attempts (owner-only)."""
    attempts = db.query(FailedLoginAttempt).order_by(
        FailedLoginAttempt.attempted_at.desc()
    ).limit(limit).all()

    # Group by IP
    by_ip = {}
    for attempt in attempts:
        if attempt.ip_address not in by_ip:
            by_ip[attempt.ip_address] = {"ip": attempt.ip_address, "count": 0, "last_attempt": None, "emails": set()}
        by_ip[attempt.ip_address]["count"] += 1
        by_ip[attempt.ip_address]["last_attempt"] = attempt.attempted_at
        if attempt.email:
            by_ip[attempt.ip_address]["emails"].add(attempt.email)

    # Convert to JSON-serializable format
    result = []
    for ip, data in sorted(by_ip.items(), key=lambda x: x[1]["last_attempt"], reverse=True):
        result.append({
            "ip": data["ip"],
            "attempts": data["count"],
            "last_attempt": data["last_attempt"],
            "attempted_emails": list(data["emails"]),
        })

    return result


@router.post("/cleanup")
def cleanup_old_data(
    _: User = Depends(require_role("owner")),
    db: DbSession = Depends(get_db),
):
    """Clean up expired bans and old failed attempts (owner-only)."""
    cleanup_expired_bans(db)
    cleanup_old_failed_attempts(db, older_than_hours=72)
    return {"detail": "Cleanup completed"}
