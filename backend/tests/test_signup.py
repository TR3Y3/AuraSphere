"""Self-serve signup + email verification, including tenant isolation."""


def _signup(client, **over):
    body = {
        "organization_name": "Cade Logistics",
        "full_name": "Cade Owner",
        "email": "cade@example.com",
        "password": "supersecret1",
    }
    body.update(over)
    return client.post("/api/auth/signup", json=body)


def test_signup_creates_org_owner_and_logs_in(client, db):
    res = _signup(client)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["user"]["role"] == "owner"
    assert data["user"]["email"] == "cade@example.com"
    assert data["user"]["email_verified"] is False
    assert data["organization"]["name"] == "Cade Logistics"
    assert data["organization"]["slug"] == "cade-logistics"
    # Console mode exposes the verify link, and the session cookie is set.
    assert data["verify_url"] and "/verify?token=" in data["verify_url"]
    assert client.get("/api/auth/me").status_code == 200

    # The new tenant exists and is isolated (legacy pipeline seeding removed).
    from app.models import Organization

    assert db.query(Organization).filter(Organization.slug == "cade-logistics").first() is not None


def test_duplicate_email_rejected(client, db):
    assert _signup(client).status_code == 201
    client.post("/api/auth/logout")
    assert _signup(client).status_code == 409


def test_slug_is_made_unique(client, db):
    assert _signup(client, email="a1@example.com").status_code == 201
    client.post("/api/auth/logout")
    second = _signup(client, email="a2@example.com")  # same org name
    assert second.status_code == 201
    assert second.json()["organization"]["slug"] == "cade-logistics-2"


def test_verify_marks_email_verified(client, db):
    url = _signup(client).json()["verify_url"]
    token = url.split("token=")[1]
    res = client.post("/api/auth/verify", json={"token": token})
    assert res.status_code == 200
    assert res.json()["user"]["email_verified"] is True
    # Token is single-use.
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 400


def test_bad_verify_token_rejected(client, db):
    _signup(client)
    assert client.post("/api/auth/verify", json={"token": "nope"}).status_code == 400


def test_resend_verification(client, db):
    _signup(client)
    assert client.post("/api/auth/resend-verification").status_code == 204


def test_new_org_is_isolated_from_existing(client, seeded, db):
    # A brand-new self-serve org must not see the seeded org's data.
    _signup(client, email="fresh@example.com")
    assert client.get("/api/companies").json()["total"] == 0
    assert client.get("/api/loads").json()["total"] == 0
