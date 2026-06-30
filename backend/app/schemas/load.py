"""Load (shipment) schemas (F2). A quote is a load in `quote` status."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, computed_field


class Ref(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ContactRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str | None = None


class LoadBase(BaseModel):
    shipper_id: int | None = None
    carrier_id: int | None = None
    primary_contact_id: int | None = None
    commodity: str | None = None
    weight: int | None = None
    equipment: str | None = None
    origin_city: str | None = None
    origin_state: str | None = None
    dest_city: str | None = None
    dest_state: str | None = None
    pickup_date: datetime | None = None
    delivery_date: datetime | None = None
    total_miles: int | None = None
    customer_rate: Decimal | None = None
    carrier_rate: Decimal | None = None
    target_rate: Decimal | None = None


class LoadCreate(LoadBase):
    status: str | None = None  # defaults to "quote"
    owner_id: int | None = None


class LoadUpdate(BaseModel):
    status: str | None = None
    shipper_id: int | None = None
    carrier_id: int | None = None
    primary_contact_id: int | None = None
    commodity: str | None = None
    weight: int | None = None
    equipment: str | None = None
    origin_city: str | None = None
    origin_state: str | None = None
    dest_city: str | None = None
    dest_state: str | None = None
    pickup_date: datetime | None = None
    delivery_date: datetime | None = None
    total_miles: int | None = None
    customer_rate: Decimal | None = None
    carrier_rate: Decimal | None = None
    target_rate: Decimal | None = None
    owner_id: int | None = None


class LoadStatusUpdate(BaseModel):
    status: str


class LoadOut(LoadBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    reference: str | None
    status: str
    owner_id: int | None
    created_by: int | None
    delivered_at: datetime | None
    created_at: datetime
    updated_at: datetime
    shipper: Ref | None = None
    carrier: Ref | None = None
    primary_contact: ContactRef | None = None

    @computed_field
    @property
    def margin(self) -> Decimal | None:
        """Customer rate − carrier rate (None unless both are set)."""
        if self.customer_rate is None or self.carrier_rate is None:
            return None
        return self.customer_rate - self.carrier_rate
