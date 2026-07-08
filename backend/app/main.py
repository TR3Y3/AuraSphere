import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app import config
from app.database import SessionLocal
from app.security_ops import get_client_ip, is_ip_banned, check_rate_limit

log = logging.getLogger("aurasphere")
from app.routers import (
    activities,
    auth,
    billing,
    carrier_ops,
    carriers,
    companies,
    dashboard,
    contacts,
    documents,
    eld,
    feedback,
    load_options,
    options_board,
    loads,
    market,
    pins,
    portal,
    prospects,
    security,
    sign,
    tracking,
    users,
)

app = FastAPI(title="AuraSphere CRM", version="0.1.0")

# Security middleware: check IP bans and rate limits BEFORE CORS (to save bandwidth on banned IPs).
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """IP ban check and rate limiting."""
    ip = get_client_ip(request)

    # Check IP ban
    if ip:
        db = SessionLocal()
        try:
            if is_ip_banned(db, ip):
                return JSONResponse(status_code=403, content={"detail": "Access denied"})

            # Check rate limit (except /health)
            if not request.url.path.startswith("/health"):
                if not check_rate_limit(ip):
                    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
        finally:
            db.close()

    response = await call_next(request)
    return response


# Add security headers
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Strict Transport Security (HTTPS only)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Content Security Policy (strict, allow only same-origin)
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# CORS: exact SPA origin with credentials so the session cookie is sent.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(companies.router)
app.include_router(contacts.router)
app.include_router(carriers.router)
app.include_router(carrier_ops.router)
app.include_router(loads.router)
app.include_router(market.router)
app.include_router(documents.router)
app.include_router(tracking.router)
app.include_router(eld.router)
app.include_router(load_options.router)
app.include_router(options_board.router)
app.include_router(sign.router)
app.include_router(portal.router)
app.include_router(pins.router)
app.include_router(prospects.router)
app.include_router(activities.router)
app.include_router(dashboard.router)
app.include_router(feedback.router)
app.include_router(users.router)
app.include_router(security.router)


# Global handlers: responses produced here flow back through the middleware
# stack, so unlike raw 500s they carry CORS headers and the browser shows a
# real error instead of an opaque "network error".
@app.exception_handler(IntegrityError)
async def on_integrity_error(request: Request, exc: IntegrityError):
    """Check-then-insert races (duplicate email/slug/…) land here as a clean
    409 instead of a raw 500."""
    log.warning("Integrity conflict on %s %s: %s", request.method, request.url.path, exc.orig)
    return JSONResponse(
        status_code=409,
        content={"detail": "That record conflicts with one that already exists. Refresh and try again."},
    )


@app.exception_handler(Exception)
async def on_unhandled_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our end. Please try again."},
    )


@app.get("/health")
def health():
    return {"status": "ok", "app": "aurasphere"}
