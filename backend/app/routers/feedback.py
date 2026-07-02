"""In-app feedback — testers report issues/ideas; emailed to the team."""
from fastapi import APIRouter, Depends, HTTPException, status as http
from pydantic import BaseModel, Field

from app import config
from app.deps import OrgScope, get_scope
from app.email import send_email

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackIn(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    page: str | None = None


@router.post("", status_code=http.HTTP_204_NO_CONTENT)
def send_feedback(payload: FeedbackIn, scope: OrgScope = Depends(get_scope)):
    """Email a tester's feedback to the team, tagged with who/where it came from."""
    u = scope.user
    body = (
        f"From: {u.full_name} <{u.email}> (org {scope.org_id}, role {u.role})\n"
        f"Page: {payload.page or '—'}\n\n"
        f"{payload.message}"
    )
    ok = send_email(config.FEEDBACK_EMAIL, "AuraSphere feedback", body)
    if not ok:
        raise HTTPException(status_code=http.HTTP_502_BAD_GATEWAY, detail="Could not send feedback")
