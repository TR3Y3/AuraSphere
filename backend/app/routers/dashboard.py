"""Dashboard + pricing analytics (F5, org-scoped).

Aggregates the org's loads into KPIs, value-by-status, and lane pricing.
Computed in Python over the org's loads (fine at brokerage scale; revisit
with SQL aggregates if volume grows).
"""
from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends

from app.deps import OrgScope, get_scope
from app.models import Activity, Load, User
from app.schemas.activity import ActivityOut
from app.schemas.dashboard import DashboardSummary, LanePrice, RepPerformance, StatusValue
from app.workflow import LOAD_PIPELINE

router = APIRouter(tags=["dashboard"])

TERMINAL = {"lost", "tonu"}
# Quotes live only on the Quotes page — the dashboard measures booked freight
# (tendered onward), so a quote isn't counted or margined until it's tendered.
OPEN_STATUSES = {"tendered", "offered", "covered", "dispatched", "in_transit"}
BOARD_STATUSES = [s for s in LOAD_PIPELINE if s != "quote"]


def _loc(city, st) -> str:
    return ", ".join(p for p in [city, st] if p) or "—"


@router.get("/api/dashboard/summary", response_model=DashboardSummary)
def summary(scope: OrgScope = Depends(get_scope)):
    # Exclude quotes entirely — they're not booked freight yet.
    loads = [ld for ld in scope.query(Load).all() if ld.status != "quote"]

    loaded = Decimal(0)
    margin_total = Decimal(0)
    margin_n = 0
    by_status: dict[str, dict] = {s: {"count": 0, "value": Decimal(0)} for s in BOARD_STATUSES}

    for ld in loads:
        cust = ld.customer_rate or Decimal(0)
        if ld.status not in TERMINAL:
            loaded += cust
        if ld.customer_rate is not None and ld.carrier_rate is not None:
            margin_total += ld.customer_rate - ld.carrier_rate
            margin_n += 1
        bucket = by_status.setdefault(ld.status, {"count": 0, "value": Decimal(0)})
        bucket["count"] += 1
        bucket["value"] += cust

    value_by_status = [
        StatusValue(status=s, count=by_status[s]["count"], value=by_status[s]["value"])
        for s in BOARD_STATUSES if by_status.get(s)
    ]

    # Rep performance: booked (non-quote) freight by owning rep — the
    # sales_code pairs with this so an owner sees who's producing at a glance.
    by_rep: dict[int, dict] = {}
    for ld in loads:
        if ld.owner_id is None or ld.status in TERMINAL:
            continue
        r = by_rep.setdefault(ld.owner_id, {"loads": 0, "dollars": Decimal(0), "margin": Decimal(0)})
        r["loads"] += 1
        r["dollars"] += ld.customer_rate or Decimal(0)
        if ld.customer_rate is not None and ld.carrier_rate is not None:
            r["margin"] += ld.customer_rate - ld.carrier_rate
    reps = []
    if by_rep:
        users = {u.id: u for u in scope.query(User).all()}
        for uid, r in by_rep.items():
            u = users.get(uid)
            reps.append(RepPerformance(
                user_id=uid, name=(u.full_name if u else f"User {uid}"),
                sales_code=(u.sales_code if u else None),
                loads=r["loads"], loaded_dollars=r["dollars"], margin=r["margin"],
            ))
        reps.sort(key=lambda x: x.margin, reverse=True)

    open_tasks = (
        scope.query(Activity)
        .filter(Activity.type == "task", Activity.completed_at.is_(None), Activity.owner_id == scope.user.id)
        .count()
    )
    recent = (
        scope.query(Activity).order_by(Activity.created_at.desc()).limit(8).all()
    )

    return DashboardSummary(
        loads_total=len(loads),
        open_loads=sum(1 for ld in loads if ld.status in OPEN_STATUSES),
        loaded_dollars=loaded,
        total_margin=margin_total,
        avg_margin=(margin_total / margin_n) if margin_n else None,
        value_by_status=value_by_status,
        open_tasks=open_tasks,
        rep_performance=reps,
        recent_activity=[ActivityOut.model_validate(a) for a in recent],
    )


@router.get("/api/pricing/lanes", response_model=list[LanePrice])
def lane_pricing(scope: OrgScope = Depends(get_scope)):
    """Org-wide lane rate reference, averaged across loads."""
    agg: dict[tuple, dict] = defaultdict(
        lambda: {"loads": 0, "cust": Decimal(0), "cust_n": 0, "carr": Decimal(0), "carr_n": 0}
    )
    for ld in scope.query(Load).all():
        key = (_loc(ld.origin_city, ld.origin_state), _loc(ld.dest_city, ld.dest_state), ld.equipment or "")
        a = agg[key]
        a["loads"] += 1
        if ld.customer_rate is not None:
            a["cust"] += ld.customer_rate; a["cust_n"] += 1
        if ld.carrier_rate is not None:
            a["carr"] += ld.carrier_rate; a["carr_n"] += 1

    out: list[LanePrice] = []
    for (origin, dest, equip), a in agg.items():
        avg_cust = a["cust"] / a["cust_n"] if a["cust_n"] else None
        avg_carr = a["carr"] / a["carr_n"] if a["carr_n"] else None
        out.append(LanePrice(
            origin=origin, destination=dest, equipment=equip or None, loads=a["loads"],
            avg_customer_rate=avg_cust, avg_carrier_rate=avg_carr,
            avg_margin=(avg_cust - avg_carr) if (avg_cust is not None and avg_carr is not None) else None,
        ))
    out.sort(key=lambda x: x.loads, reverse=True)
    return out
