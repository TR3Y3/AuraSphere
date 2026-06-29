from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routers import auth, companies, contacts, users

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
app.include_router(companies.router)
app.include_router(contacts.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "aurasphere"}
