"""Tenant isolation: a user in org A must never see org B's data."""


def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text


def test_user_only_sees_own_org_companies(client, seeded):
    _login(client, "a@example.com", "password-a")
    rows = client.get("/api/companies").json()
    names = {c["name"] for c in rows}
    org_ids = {c["organization_id"] for c in rows}
    assert names == {"Acme A"}
    assert org_ids == {seeded["org_a"]}


def test_other_org_data_is_invisible(client, seeded):
    # User B sees only Globex B, never Acme A.
    _login(client, "b@example.com", "password-b")
    rows = client.get("/api/companies").json()
    names = {c["name"] for c in rows}
    assert names == {"Globex B"}
    assert "Acme A" not in names


def test_companies_requires_auth(client, seeded):
    assert client.get("/api/companies").status_code == 401
