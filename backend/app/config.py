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
# Optional parent domain so app.<domain> and api.<domain> share the cookie.
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None

# Seed command inputs (used by `python -m app.seed`)
SEED_ORG_NAME = os.getenv("SEED_ORG_NAME", "AuraSphere")
SEED_ORG_SLUG = os.getenv("SEED_ORG_SLUG", "aurasphere")
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL")
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD")
SEED_ADMIN_NAME = os.getenv("SEED_ADMIN_NAME", "Admin")
