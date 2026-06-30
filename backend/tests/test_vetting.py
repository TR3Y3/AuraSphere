"""Carrier vetting: deterministic stub results, latest snapshot, isolation."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _carrier(client, **over):
    body = {"name": "Acme Trucking", "mc_number": "MC123456", "dot_number": "DOT789",
            "auto_liability": "1000000", "cargo_coverage": "100000", "rating": "4.5"}
    body.update(over)
    return client.post("/api/carriers", json=body).json()


def test_clean_carrier_vets_clear(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid = _carrier(client)["id"]
    res = client.post(f"/api/carriers/{cid}/vet")
    assert res.status_code == 201, res.text
    v = res.json()
    assert v["result"] == "clear"
    assert v["authority_status"] == "active"
    assert v["insurance_on_file"] is True
    assert v["safety_rating"] == "Satisfactory"
    assert v["risk_score"] == 100
    assert v["flags"] == []


def test_missing_authority_and_insurance_fails(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid = _carrier(client, mc_number=None, dot_number=None,
                   auto_liability=None, cargo_coverage=None)["id"]
    v = client.post(f"/api/carriers/{cid}/vet").json()
    assert v["result"] == "fail"
    assert v["authority_status"] == "not_found"
    assert v["insurance_on_file"] is False
    assert any("MC/DOT" in f for f in v["flags"])
    assert v["risk_score"] < 50


def test_partial_issues_flag_review(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    # Authority + insurance present, but no rating → review (not fail).
    cid = _carrier(client, rating=None)["id"]
    v = client.post(f"/api/carriers/{cid}/vet").json()
    assert v["result"] == "review"
    assert v["safety_rating"] == "Not Rated"


def test_latest_vetting_returns_most_recent(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid = _carrier(client)["id"]
    assert client.get(f"/api/carriers/{cid}/vetting").json() is None  # not vetted yet
    client.post(f"/api/carriers/{cid}/vet")
    second = client.post(f"/api/carriers/{cid}/vet").json()
    latest = client.get(f"/api/carriers/{cid}/vetting").json()
    assert latest["id"] == second["id"]


def test_vetting_is_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid = _carrier(client)["id"]
    client.post(f"/api/carriers/{cid}/vet")

    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.get(f"/api/carriers/{cid}/vetting").status_code == 404
    assert client.post(f"/api/carriers/{cid}/vet").status_code == 404
