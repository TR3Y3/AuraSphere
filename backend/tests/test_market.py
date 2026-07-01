"""DAT market rates: deterministic stub, equipment tiers, per-load, auth."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_rate_lookup_is_deterministic_and_scales_with_miles(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    q = {"origin": "Rincon, GA", "dest": "Dallas, TX", "equipment": "53' Van", "miles": 1000}
    r1 = client.get("/api/market/rate", params=q).json()
    r2 = client.get("/api/market/rate", params=q).json()
    assert r1 == r2  # deterministic
    assert r1["miles"] == 1000
    assert r1["total_avg"] == round(r1["rate_per_mile_avg"] * 1000, 2)
    assert r1["rate_per_mile_low"] < r1["rate_per_mile_avg"] < r1["rate_per_mile_high"]
    assert r1["confidence"] == "medium"


def test_equipment_changes_the_rate(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    base = {"origin": "A", "dest": "B", "miles": 500}
    reefer = client.get("/api/market/rate", params={**base, "equipment": "Reefer"}).json()
    van = client.get("/api/market/rate", params={**base, "equipment": "Van"}).json()
    # Reefer carries a premium over dry van.
    assert reefer["rate_per_mile_avg"] > van["rate_per_mile_avg"]


def test_missing_miles_still_returns_per_mile(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    r = client.get("/api/market/rate", params={"origin": "A", "dest": "B"}).json()
    assert r["total_avg"] is None
    assert r["rate_per_mile_avg"] > 0
    assert r["confidence"] == "low"


def test_per_load_market_rate(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={
        "shipper_id": sh.id, "equipment": "Reefer", "total_miles": 800,
        "origin_city": "Rincon", "origin_state": "GA", "dest_city": "Dallas", "dest_state": "TX",
    }).json()["id"]
    r = client.get(f"/api/market/rate/load/{lid}").json()
    assert r["miles"] == 800
    assert r["total_avg"] == round(r["rate_per_mile_avg"] * 800, 2)


def test_rate_requires_auth(client, seeded, db):
    assert client.get("/api/market/rate", params={"origin": "A", "dest": "B"}).status_code == 401


def test_per_load_rate_is_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]
    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.get(f"/api/market/rate/load/{lid}").status_code == 404
