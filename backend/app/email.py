"""Minimal outbound email.

Two modes (config.EMAIL_DELIVERY):
  - "console" (default): log the message instead of sending. Used in dev and
    until an SMTP provider is configured; the signup flow surfaces the verify
    link directly so it's testable without a mailbox.
  - "smtp": send via the configured SMTP server.

This is intentionally tiny; swap in a provider SDK (SES/Postmark/Resend) later
behind the same `send_email` signature.
"""
import logging
import smtplib
from email.message import EmailMessage

from app import config

log = logging.getLogger("aurasphere.email")


def send_email(to: str, subject: str, body: str) -> None:
    if config.EMAIL_DELIVERY != "smtp" or not config.SMTP_HOST:
        log.info("[email:console] to=%s subject=%s\n%s", to, subject, body)
        return

    msg = EmailMessage()
    msg["From"] = config.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as server:
        server.starttls()
        if config.SMTP_USER:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD or "")
        server.send_message(msg)


def send_verification_email(to: str, verify_url: str) -> None:
    send_email(
        to,
        "Verify your AuraSphere email",
        "Welcome to AuraSphere!\n\n"
        "Confirm your email address to finish setting up your brokerage:\n\n"
        f"{verify_url}\n\n"
        f"This link expires in {config.VERIFY_TTL_HOURS} hours.",
    )
