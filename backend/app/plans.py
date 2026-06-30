"""Plan definitions + entitlements (plan-gating).

The org's `plan` column ('free' | 'pro') drives what it can do. Keep all the
gating rules here so endpoints stay declarative.
"""
from app import config

PLANS = {
    "free": {
        "label": "Free",
        "price": "$0",
        "blurb": "Get a brokerage running.",
        "features": [
            f"Up to {config.FREE_MAX_LOADS} loads",
            "Carriers, shippers & contacts",
            "Load board & quotes",
            "Tracking & documents",
        ],
    },
    "pro": {
        "label": "Pro",
        "price": "$99/mo",
        "blurb": "Scale without limits.",
        "features": [
            "Unlimited loads",
            "Everything in Free",
            "Priority support",
            "Lead-Gen prospecting",
        ],
    },
}


def normalize(plan: str | None) -> str:
    return plan if plan in PLANS else "free"


def max_loads(plan: str | None) -> int | None:
    """Load ceiling for the plan; None means unlimited."""
    return None if normalize(plan) == "pro" else config.FREE_MAX_LOADS


def is_pro(plan: str | None) -> bool:
    return normalize(plan) == "pro"
