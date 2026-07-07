"""Pydantic v2 schemas for auth + identity."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    organization_name: str = Field(min_length=1, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    role: str = "member"


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    plan: str
    accent_color: str | None = None
    logo_url: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str
    sales_code: str | None = None
    is_active: bool
    organization_id: int
    created_at: datetime
    email_verified_at: datetime | None = None

    @computed_field
    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None


class MeOut(BaseModel):
    user: UserOut
    organization: OrganizationOut


class SignupResult(MeOut):
    # Present only in console email mode so the verify flow is testable
    # without a mailbox; omitted once real SMTP is configured.
    verify_url: str | None = None


class InviteResult(BaseModel):
    user: UserOut
    # Present only in console email mode so the invite is testable without a mailbox.
    invite_url: str | None = None
