"""Billing endpoints: plan status, upgrade checkout, manage portal, webhook."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status as http
from sqlalchemy.orm import Session as DbSession

from app import billing, config, plans
from app.database import get_db
from app.deps import OrgScope, get_scope, require_role
from app.models import Load, Organization, User
from app.schemas.billing import BillingStatus, CheckoutOut, PlanInfo, PortalOut

log = logging.getLogger("aurasphere.billing")

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _plan_catalog() -> list[PlanInfo]:
    return [PlanInfo(key=k, **v) for k, v in plans.PLANS.items()]


def _org(scope: OrgScope) -> Organization:
    return scope.db.query(Organization).filter(Organization.id == scope.org_id).first()


@router.get("", response_model=BillingStatus)
def get_billing(scope: OrgScope = Depends(get_scope)):
    org = _org(scope)
    loads_used = scope.query(Load).count()
    return BillingStatus(
        plan=plans.normalize(org.plan),
        label=plans.PLANS[plans.normalize(org.plan)]["label"],
        is_pro=plans.is_pro(org.plan),
        configured=billing.is_configured(),
        loads_used=loads_used,
        max_loads=plans.max_loads(org.plan),
        plans=_plan_catalog(),
    )


@router.post("/checkout", response_model=CheckoutOut)
def checkout(scope: OrgScope = Depends(get_scope), _: User = Depends(require_role("owner"))):
    org = _org(scope)
    success = f"{config.FRONTEND_ORIGIN}/settings?billing=success"
    cancel = f"{config.FRONTEND_ORIGIN}/settings?billing=cancel"
    try:
        url = billing.start_checkout(scope.db, org, success, cancel)
    except Exception:  # noqa: BLE001
        log.exception("checkout failed for org=%s", org.id)
        raise HTTPException(status_code=http.HTTP_502_BAD_GATEWAY, detail="Could not start checkout")
    return CheckoutOut(url=url)


@router.post("/portal", response_model=PortalOut)
def portal(scope: OrgScope = Depends(get_scope), _: User = Depends(require_role("owner"))):
    org = _org(scope)
    return_url = f"{config.FRONTEND_ORIGIN}/settings"
    try:
        url = billing.start_portal(scope.db, org, return_url)
    except Exception:  # noqa: BLE001
        log.exception("portal failed for org=%s", org.id)
        raise HTTPException(status_code=http.HTTP_502_BAD_GATEWAY, detail="Could not open billing portal")
    return PortalOut(url=url)


@router.post("/downgrade", response_model=BillingStatus)
def downgrade(scope: OrgScope = Depends(get_scope), _: User = Depends(require_role("owner"))):
    """Cancel Pro. In stub mode this is immediate; with real Stripe, cancellation
    flows through the billing portal, so direct downgrade is rejected."""
    if billing.is_configured():
        raise HTTPException(
            status_code=http.HTTP_400_BAD_REQUEST,
            detail="Manage your subscription through the billing portal",
        )
    org = _org(scope)
    org.plan = "free"
    scope.db.commit()
    return get_billing(scope)


@router.post("/webhook", status_code=http.HTTP_200_OK)
async def webhook(request: Request, db: DbSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature")
    try:
        event = billing.verify_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=http.HTTP_400_BAD_REQUEST, detail=str(e))
    billing.apply_event(db, event)
    return {"received": True}
