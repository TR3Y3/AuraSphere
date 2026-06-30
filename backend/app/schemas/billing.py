"""Billing / plan schemas."""
from pydantic import BaseModel


class PlanInfo(BaseModel):
    key: str
    label: str
    price: str
    blurb: str
    features: list[str]


class BillingStatus(BaseModel):
    plan: str
    label: str
    is_pro: bool
    configured: bool  # real Stripe wired vs stub mode
    loads_used: int
    max_loads: int | None  # None = unlimited
    plans: list[PlanInfo]


class CheckoutOut(BaseModel):
    url: str


class PortalOut(BaseModel):
    url: str | None
