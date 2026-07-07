"""FMCSA carrier lookup — MC/DOT → legal name, address, authority status.

Modes (config.FMCSA_MODE):
  - "stub" (default): deterministic, plausible data derived from the MC number
    so the auto-populate flow is fully demoable with no key.
  - "qcmobile": the real FMCSA QCMobile API (free webkey). Same return shape;
    falls back to the stub on any error so the form never breaks.
"""
import hashlib
import logging

import httpx

from app import config

log = logging.getLogger("aurasphere.fmcsa")

QCMOBILE_API = "https://mobile.fmcsa.dot.gov/qc/services/carriers"

_NAME_A = ["Summit", "Redline", "Blue Ridge", "Ironwood", "Prairie", "Gulf Coast",
           "Keystone", "High Plains", "Riverbend", "Silver Star", "Lone Pine", "Cascade"]
_NAME_B = ["Logistics", "Transport", "Carriers", "Freight Lines", "Trucking", "Haulers"]
_CITIES = [("Memphis", "TN"), ("Dallas", "TX"), ("Atlanta", "GA"), ("Joliet", "IL"),
           ("Columbus", "OH"), ("Fontana", "CA"), ("Charlotte", "NC"), ("Laredo", "TX"),
           ("Kansas City", "MO"), ("Allentown", "PA"), ("Savannah", "GA"), ("Reno", "NV")]


def _stub_lookup(mc: str) -> dict:
    digits = "".join(ch for ch in mc if ch.isdigit()) or "0"
    h = int(hashlib.sha256(digits.encode()).hexdigest()[:8], 16)
    city, state = _CITIES[h % len(_CITIES)]
    return {
        "found": True,
        "source": "stub",
        "legal_name": f"{_NAME_A[h % len(_NAME_A)]} {_NAME_B[(h >> 4) % len(_NAME_B)]} LLC",
        "mc_number": f"MC{digits}",
        "dot_number": str(1000000 + (h % 3000000)),
        "city": city,
        "state": state,
        "phone": f"({200 + h % 700}) 555-{1000 + h % 9000}",
        "authority_status": "active" if h % 10 else "inactive",  # ~10% inactive for demo variety
    }


def lookup_mc(mc: str) -> dict:
    """Look up a carrier by MC/docket number. Never raises."""
    if config.FMCSA_MODE == "qcmobile" and config.FMCSA_WEBKEY:
        try:
            digits = "".join(ch for ch in mc if ch.isdigit())
            resp = httpx.get(
                f"{QCMOBILE_API}/docket-number/{digits}",
                params={"webKey": config.FMCSA_WEBKEY},
                timeout=10.0,
            )
            resp.raise_for_status()
            content = resp.json().get("content") or []
            if not content:
                return {"found": False, "source": "qcmobile"}
            c = content[0].get("carrier", {})
            return {
                "found": True,
                "source": "qcmobile",
                "legal_name": c.get("legalName"),
                "mc_number": f"MC{digits}",
                "dot_number": str(c.get("dotNumber") or ""),
                "city": c.get("phyCity"),
                "state": c.get("phyState"),
                "phone": c.get("phone"),
                "authority_status": "active" if c.get("allowedToOperate") == "Y" else "inactive",
            }
        except Exception:  # noqa: BLE001 — lookup is a convenience, never break the form
            log.exception("FMCSA lookup failed for %s; falling back to stub", mc)
    return _stub_lookup(mc)
