"""Outbound email.

Delivery modes (config.EMAIL_DELIVERY):
  - "console" (default): log the message instead of sending. Used in dev and
    until a provider is configured; the signup flow surfaces the verify link
    directly so it's testable without a mailbox.
  - "resend": send via the Resend HTTP API. Preferred in production — works on
    hosts (like Render) that block outbound SMTP ports.
  - "smtp": send via a classic SMTP server.

Sends are best-effort: a delivery failure is logged and `send_email` returns
False rather than raising, so a misconfigured/temporarily-down provider can
never break user-facing flows like signup. Swap in another provider later
behind this same signature.
"""
import logging
import smtplib
from email.message import EmailMessage

import httpx

from app import config

log = logging.getLogger("aurasphere.email")

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _send_resend(to: str, subject: str, body: str) -> None:
    resp = httpx.post(
        RESEND_ENDPOINT,
        headers={"Authorization": f"Bearer {config.RESEND_API_KEY}"},
        json={"from": config.EMAIL_FROM, "to": [to], "subject": subject, "text": body},
        timeout=10.0,
    )
    resp.raise_for_status()


def _send_smtp(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = config.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as server:
        server.starttls()
        if config.SMTP_USER:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD or "")
        server.send_message(msg)


def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via the configured provider. Returns True on success.

    Never raises — failures are logged so callers (signup, resend) stay robust.
    """
    mode = config.EMAIL_DELIVERY
    try:
        if mode == "resend" and config.RESEND_API_KEY:
            _send_resend(to, subject, body)
        elif mode == "smtp" and config.SMTP_HOST:
            _send_smtp(to, subject, body)
        else:
            # console / unconfigured: log instead of sending.
            log.info("[email:console] to=%s subject=%s\n%s", to, subject, body)
        return True
    except Exception:  # noqa: BLE001 — delivery must never break the caller
        log.exception("Failed to send email to %s (mode=%s)", to, mode)
        return False


def send_verification_email(to: str, verify_url: str) -> bool:
    return send_email(
        to,
        "Verify your AuraSphere email",
        "Welcome to AuraSphere!\n\n"
        "Confirm your email address to finish setting up your brokerage:\n\n"
        f"{verify_url}\n\n"
        f"This link expires in {config.VERIFY_TTL_HOURS} hours.",
    )
