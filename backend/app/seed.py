"""Seed commands driven by env vars.

Usage:
    python -m app.seed seed-org     # create/ensure the organization
    python -m app.seed seed-admin   # create/ensure the owner user
    python -m app.seed all          # both, in order

Inputs (env): SEED_ORG_NAME, SEED_ORG_SLUG, SEED_ADMIN_EMAIL,
SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME. Both commands are idempotent.
"""
import sys

from app import config
from app.database import SessionLocal
from app.defaults import ensure_default_pipeline
from app.models import Organization, User
from app.security import hash_password


def seed_org() -> Organization:
    db = SessionLocal()
    try:
        org = (
            db.query(Organization)
            .filter(Organization.slug == config.SEED_ORG_SLUG)
            .first()
        )
        if org:
            print(f"Org '{org.slug}' already exists (id={org.id}).")
            return org
        org = Organization(name=config.SEED_ORG_NAME, slug=config.SEED_ORG_SLUG)
        db.add(org)
        db.commit()
        db.refresh(org)
        ensure_default_pipeline(db, org.id)
        print(f"Created org '{org.slug}' (id={org.id}) with default pipeline.")
        return org
    finally:
        db.close()


def seed_admin() -> User:
    if not config.SEED_ADMIN_EMAIL or not config.SEED_ADMIN_PASSWORD:
        raise SystemExit(
            "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed an admin."
        )
    db = SessionLocal()
    try:
        org = (
            db.query(Organization)
            .filter(Organization.slug == config.SEED_ORG_SLUG)
            .first()
        )
        if not org:
            raise SystemExit(
                f"No org with slug '{config.SEED_ORG_SLUG}'. Run seed-org first."
            )
        email = config.SEED_ADMIN_EMAIL.lower()
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User '{email}' already exists (id={existing.id}).")
            return existing
        user = User(
            organization_id=org.id,
            email=email,
            password_hash=hash_password(config.SEED_ADMIN_PASSWORD),
            full_name=config.SEED_ADMIN_NAME,
            role="owner",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created owner '{email}' (id={user.id}) in org '{org.slug}'.")
        return user
    finally:
        db.close()


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "seed-org":
        seed_org()
    elif cmd == "seed-admin":
        seed_admin()
    elif cmd == "all":
        seed_org()
        seed_admin()
    else:
        raise SystemExit(f"Unknown command '{cmd}'. Use seed-org | seed-admin | all.")


if __name__ == "__main__":
    main()
