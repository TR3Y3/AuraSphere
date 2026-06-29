"""Test fixtures: an isolated SQLite DB per test run with two seeded orgs.

Each test gets a TestClient wired to a fresh schema. We seed two
organizations (A and B), each with a user and a company, so tenant
isolation can be asserted directly.
"""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Force a throwaway DB before any app module reads DATABASE_URL.
os.environ["DATABASE_URL"] = "sqlite:///./test_pytest.db"

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Company, Organization, User  # noqa: E402
from app.security import hash_password  # noqa: E402

engine = create_engine(
    "sqlite:///./test_pytest.db", connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seeded(db):
    """Two orgs, each with one user and one company."""
    org_a = Organization(name="Org A", slug="org-a")
    org_b = Organization(name="Org B", slug="org-b")
    db.add_all([org_a, org_b])
    db.flush()

    user_a = User(
        organization_id=org_a.id,
        email="a@example.com",
        password_hash=hash_password("password-a"),
        full_name="User A",
        role="owner",
    )
    user_b = User(
        organization_id=org_b.id,
        email="b@example.com",
        password_hash=hash_password("password-b"),
        full_name="User B",
        role="owner",
    )
    db.add_all([user_a, user_b])
    db.flush()

    db.add_all(
        [
            Company(organization_id=org_a.id, name="Acme A", owner_id=user_a.id),
            Company(organization_id=org_b.id, name="Globex B", owner_id=user_b.id),
        ]
    )
    db.commit()
    return {
        "org_a": org_a.id,
        "org_b": org_b.id,
        "user_a": "a@example.com",
        "user_b": "b@example.com",
    }


@pytest.fixture()
def client():
    return TestClient(app)
