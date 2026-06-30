"""Billing / subscriptions.

Two modes (config.BILLING_MODE):
  - "stub" (default): no Stripe. `start_checkout` upgrades the org immediately
    and returns the success URL, so the whole upgrade→unlock loop is testable
    without keys. `start_portal`/webhooks are no-ops.
  - "stripe": real Stripe Checkout + Billing Portal + webhooks, called over the
    Stripe REST API with httpx (no SDK dependency, matching app/email.py).

Stripe's webhook signature is verified with the stdlib (hmac/hashlib).
"""
import hashlib
import hmac
import json
import logging
import time

import httpx
from sqlalchemy.orm import Session as DbSession

from app import config
from app.models import Organization

log = logging.getLogger("aurasphere.billing")

STRIPE_API = "https://api.stripe.com/v1"


def is_stripe() -> bool:
    return config.BILLING_MODE == "stripe" and bool(config.STRIPE_SECRET_KEY)


def is_configured() -> bool:
    """Whether real payments are wired (otherwise we're in stub mode)."""
    return is_stripe() and bool(config.STRIPE_PRICE_ID)


def _stripe_post(path: str, data: dict) -> dict:
    resp = httpx.post(
        f"{STRIPE_API}{path}",
        headers={"Authorization": f"Bearer {config.STRIPE_SECRET_KEY}"},
        data=data,
        timeout=15.0,
    )
    resp.raise_for_status()
    return resp.json()


def start_checkout(db: DbSession, org: Organization, success_url: str, cancel_url: str) -> str:
    """Return a URL to send the owner to in order to upgrade to Pro."""
    if not is_configured():
        # Stub: simulate a completed checkout so the unlock is immediate.
        org.plan = "pro"
        db.commit()
        log.info("[billing:stub] upgraded org=%s to pro", org.id)
        return success_url

    session = _stripe_post(
        "/checkout/sessions",
        {
            "mode": "subscription",
            "line_items[0][price]": config.STRIPE_PRICE_ID,
            "line_items[0][quantity]": "1",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": str(org.id),
            **({"customer": org.stripe_customer_id} if org.stripe_customer_id else {}),
        },
    )
    return session["url"]


def start_portal(db: DbSession, org: Organization, return_url: str) -> str | None:
    """Stripe Billing Portal URL to manage/cancel; None in stub mode."""
    if not is_configured() or not org.stripe_customer_id:
        return None
    session = _stripe_post(
        "/billing_portal/sessions",
        {"customer": org.stripe_customer_id, "return_url": return_url},
    )
    return session["url"]


def verify_webhook(payload: bytes, sig_header: str | None) -> dict:
    """Validate a Stripe webhook signature and return the parsed event."""
    secret = config.STRIPE_WEBHOOK_SECRET
    if not secret or not sig_header:
        raise ValueError("missing webhook secret or signature")

    parts = dict(p.split("=", 1) for p in sig_header.split(",") if "=" in p)
    timestamp, given = parts.get("t"), parts.get("v1")
    if not timestamp or not given:
        raise ValueError("malformed signature header")
    # Reject very old timestamps (replay protection: 5 min tolerance).
    if abs(time.time() - int(timestamp)) > 300:
        raise ValueError("timestamp outside tolerance")

    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, given):
        raise ValueError("signature mismatch")
    return json.loads(payload)


def apply_event(db: DbSession, event: dict) -> None:
    """Update an org's plan from a Stripe subscription/checkout event."""
    etype = event.get("type")
    obj = event.get("data", {}).get("object", {})

    if etype == "checkout.session.completed":
        org_id = obj.get("client_reference_id")
        org = db.query(Organization).filter(Organization.id == int(org_id)).first() if org_id else None
        if org:
            org.plan = "pro"
            org.stripe_customer_id = obj.get("customer") or org.stripe_customer_id
            org.stripe_subscription_id = obj.get("subscription") or org.stripe_subscription_id
            db.commit()

    elif etype in ("customer.subscription.deleted", "customer.subscription.updated"):
        sub_id = obj.get("id")
        org = (
            db.query(Organization)
            .filter(Organization.stripe_subscription_id == sub_id)
            .first()
            if sub_id
            else None
        )
        if org:
            active = etype == "customer.subscription.updated" and obj.get("status") in (
                "active",
                "trialing",
            )
            org.plan = "pro" if active else "free"
            db.commit()
