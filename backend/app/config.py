"""Runtime configuration sourced from environment variables."""
import os

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

# SPA origin allowed by CORS (must be an exact origin when credentials are on)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

# Session cookie
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "aurasphere_session")
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "168"))  # 7 days
# Cookie flags. Secure must be on in production (https); off for local http.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
# SameSite policy. Local dev: "lax". When the SPA and API live on different
# sites (e.g. app.onrender.com + api.onrender.com), the auth cookie must be
# "none" so the browser sends it on cross-site XHR — and "none" REQUIRES
# Secure, so we force it on below.
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
if COOKIE_SAMESITE == "none":
    COOKIE_SECURE = True
# Optional parent domain so app.<domain> and api.<domain> share the cookie.
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None

# Email delivery (signup verification, later notifications).
#   "console" (default) — logs the message + returns the verify link in the
#     signup response so the flow is testable without a mailbox.
#   "resend"  — Resend HTTP API (set RESEND_API_KEY). Preferred in production;
#     works on hosts like Render that block outbound SMTP ports.
#   "smtp"    — classic SMTP (set SMTP_HOST/PORT/USER/PASSWORD).
EMAIL_DELIVERY = os.getenv("EMAIL_DELIVERY", "console").lower()
EMAIL_FROM = os.getenv("EMAIL_FROM", "no-reply@aurasphere.app")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
# Hours a signup email-verification token stays valid.
VERIFY_TTL_HOURS = int(os.getenv("VERIFY_TTL_HOURS", "48"))

# Billing / plan-gating.
#   "stub" (default) — no Stripe needed; checkout instantly upgrades the org so
#     the upgrade→unlock loop is fully testable. Use for dev/demo.
#   "stripe" — real Stripe Checkout + Billing Portal + webhooks via the Stripe
#     REST API (set STRIPE_SECRET_KEY / STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET).
BILLING_MODE = os.getenv("BILLING_MODE", "stub").lower()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")  # the Pro recurring price
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
# Free-plan ceilings (None = unlimited on Pro).
FREE_MAX_LOADS = int(os.getenv("FREE_MAX_LOADS", "50"))

# Carrier vetting (Highway / Carrier411-style authority + insurance + safety).
#   "stub" (default) — derive a deterministic vetting result from the carrier's
#     own data (MC/DOT, insurance, rating). No external account needed.
#   "highway" — call the real provider API (set HIGHWAY_API_KEY).
VETTING_MODE = os.getenv("VETTING_MODE", "stub").lower()
HIGHWAY_API_KEY = os.getenv("HIGHWAY_API_KEY")

# Seed command inputs (used by `python -m app.seed`)
SEED_ORG_NAME = os.getenv("SEED_ORG_NAME", "AuraSphere")
SEED_ORG_SLUG = os.getenv("SEED_ORG_SLUG", "aurasphere")
SEED_ORG_ACCENT = os.getenv("SEED_ORG_ACCENT")  # hex like #1f6feb (per-tenant brand)
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL")
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD")
SEED_ADMIN_NAME = os.getenv("SEED_ADMIN_NAME", "Admin")
