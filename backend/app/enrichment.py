"""Contact enrichment for Lead-Gen prospects.

Adapted from CALCOR's Hunter.io lead-enrichment approach (domain-search →
best-fit contact), rewritten for AuraSphere's stub-seam pattern.

Modes (config.ENRICHMENT_MODE):
  - "stub" (default): deterministic demo contact derived from the domain so
    the enrich flow is demoable with no key.
  - "hunter": Hunter.io domain-search. Prefers logistics/shipping/supply-chain
    titles; falls back to the most confident contact. Never raises.
"""
import hashlib
import logging

import httpx

from app import config

log = logging.getLogger("aurasphere.enrichment")

HUNTER_API = "https://api.hunter.io/v2/domain-search"

# Titles we most want at a shipper (checked in order).
_PREFERRED_TITLES = ("logistics", "shipping", "supply chain", "transport",
                     "warehouse", "operations", "procurement", "purchasing")

_FIRST = ["Jordan", "Casey", "Morgan", "Riley", "Avery", "Quinn", "Dana", "Alex"]
_LAST = ["Walker", "Reed", "Bennett", "Hayes", "Brooks", "Carter", "Malone", "Ortiz"]
_TITLES = ["Logistics Manager", "Shipping Supervisor", "Supply Chain Director",
           "Operations Manager", "Transportation Lead"]


def _stub_enrich(domain: str) -> dict | None:
    h = int(hashlib.sha256(domain.lower().encode()).hexdigest()[:8], 16)
    first = _FIRST[h % len(_FIRST)]
    last = _LAST[(h >> 3) % len(_LAST)]
    return {
        "source": "stub",
        "contact_name": f"{first} {last}",
        "contact_title": _TITLES[(h >> 6) % len(_TITLES)],
        "contact_email": f"{first.lower()}.{last.lower()}@{domain.lower()}",
        "contact_phone": f"({200 + h % 700}) 555-{1000 + h % 9000}",
    }


def _hunter_enrich(domain: str) -> dict | None:
    resp = httpx.get(
        HUNTER_API,
        params={"domain": domain, "api_key": config.HUNTER_API_KEY, "limit": 10},
        timeout=10.0,
    )
    resp.raise_for_status()
    emails = (resp.json().get("data") or {}).get("emails") or []
    if not emails:
        return None

    def rank(e: dict) -> tuple:
        title = (e.get("position") or "").lower()
        pref = next((i for i, kw in enumerate(_PREFERRED_TITLES) if kw in title),
                    len(_PREFERRED_TITLES))
        return (pref, -(e.get("confidence") or 0))

    best = sorted(emails, key=rank)[0]
    name = " ".join(p for p in [best.get("first_name"), best.get("last_name")] if p)
    return {
        "source": "hunter",
        "contact_name": name or None,
        "contact_title": best.get("position"),
        "contact_email": best.get("value"),
        "contact_phone": best.get("phone_number"),
    }


def enrich_domain(domain: str) -> dict | None:
    """Find the best shipper-side contact for a domain. Never raises."""
    if not domain:
        return None
    if config.ENRICHMENT_MODE == "hunter" and config.HUNTER_API_KEY:
        try:
            return _hunter_enrich(domain)
        except Exception:  # noqa: BLE001 — enrichment is best-effort
            log.exception("Hunter enrichment failed for %s; falling back to stub", domain)
    return _stub_enrich(domain)
