"""Carrier vetting (Highway / Carrier411-style authority + insurance + safety).

Modes (config.VETTING_MODE):
  - "stub" (default): derive a deterministic result from the carrier's own data
    (MC/DOT on file, insurance coverage, rating). No external account needed —
    good for dev/demo and a sensible offline fallback.
  - "highway": call the real provider (set HIGHWAY_API_KEY). Wired later behind
    this same `vet_carrier` signature.

Returns a dict: source, result ('clear'|'review'|'fail'), authority_status,
insurance_on_file, safety_rating, risk_score (0–100, higher = safer), flags[].
"""
from app import config
from app.models import Carrier


def _stub_vet(carrier: Carrier) -> dict:
    flags: list[str] = []
    score = 100

    has_authority = bool(carrier.mc_number or carrier.dot_number)
    authority_status = "active" if has_authority else "not_found"
    if not has_authority:
        flags.append("No MC/DOT on file — authority cannot be verified")
        score -= 45

    has_auto = carrier.auto_liability is not None
    has_cargo = carrier.cargo_coverage is not None
    insurance_on_file = has_auto and has_cargo
    if not has_auto:
        flags.append("No auto-liability insurance on file")
        score -= 25
    if not has_cargo:
        flags.append("No cargo coverage on file")
        score -= 20

    rating = float(carrier.rating) if carrier.rating is not None else None
    if rating is None:
        safety_rating = "Not Rated"
        flags.append("No safety rating yet")
        score -= 5
    elif rating >= 4.0:
        safety_rating = "Satisfactory"
    elif rating >= 2.5:
        safety_rating = "Conditional"
        flags.append("Conditional safety rating")
        score -= 15
    else:
        safety_rating = "Unsatisfactory"
        flags.append("Unsatisfactory safety rating")
        score -= 35

    if carrier.status == "deactivated":
        flags.append("Carrier is deactivated in your system")
        score -= 20

    score = max(0, min(100, score))
    # Verdict: a hard fail blocks booking; review = proceed with caution.
    if not has_authority or not insurance_on_file or score < 50:
        result = "fail"
    elif flags:
        result = "review"
    else:
        result = "clear"

    return {
        "source": "stub",
        "result": result,
        "authority_status": authority_status,
        "insurance_on_file": insurance_on_file,
        "safety_rating": safety_rating,
        "risk_score": score,
        "flags": flags,
    }


def vet_carrier(carrier: Carrier) -> dict:
    if config.VETTING_MODE == "highway" and config.HIGHWAY_API_KEY:
        # Real Highway API call lands here (same return shape). Until then,
        # fall back to the deterministic stub so the feature always works.
        pass
    return _stub_vet(carrier)
