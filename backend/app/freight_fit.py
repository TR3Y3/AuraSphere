"""Freight-fit scoring for shipper prospects (S2).

A lightweight heuristic that estimates how likely a company is to have
freight to move, from its industry/description. Real signals (shipment
volume, dock counts, enrichment data) can refine this later.
"""

# (keywords, points, reason) — first match wins per tier, points accumulate.
STRONG = ("manufactur", "distribut", "wholesale", "food", "beverage",
          "building material", "lumber", "steel", "produce", "cold storage",
          "agricultur", "chemical", "plastics", "paper", "packaging", "furniture")
MEDIUM = ("retail", "consumer goods", "industrial", "supply", "warehouse", "import", "export")
# Competitors / poor fit — they are not shippers we sell to.
NEGATIVE = ("broker", "3pl", "third party logistics", "carrier", "trucking", "freight forwarder")


def score_freight_fit(industry: str | None, name: str | None = None) -> tuple[int, str]:
    """Return (score 0–100, human reason)."""
    text = f"{industry or ''} {name or ''}".lower()
    if not text.strip():
        return 50, "No industry on file — needs research."

    for kw in NEGATIVE:
        if kw in text:
            return 10, f"Looks like a logistics competitor ({kw}); not a shipper."

    for kw in STRONG:
        if kw in text:
            return 85, f"Strong freight signal: {kw} companies ship regularly."

    for kw in MEDIUM:
        if kw in text:
            return 60, f"Possible freight: {kw}; confirm volume."

    return 40, "Weak/unknown freight signal; verify they ship."
