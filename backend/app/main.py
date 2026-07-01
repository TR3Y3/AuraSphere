from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routers import (
    activities,
    auth,
    billing,
    carrier_ops,
    carriers,
    companies,
    dashboard,
    contacts,
    deals,
    documents,
    eld,
    load_options,
    loads,
    market,
    pins,
    pipelines,
    prospects,
    tracking,
    users,
)

app = FastAPI(title="AuraSphere CRM", version="0.1.0")

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
app.include_router(pipelines.router)
app.include_router(deals.router)
app.include_router(loads.router)
app.include_router(market.router)
app.include_router(documents.router)
app.include_router(tracking.router)
app.include_router(eld.router)
app.include_router(load_options.router)
app.include_router(pins.router)
app.include_router(prospects.router)
app.include_router(activities.router)
app.include_router(dashboard.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "aurasphere"}
