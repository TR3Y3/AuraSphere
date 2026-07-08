"""Org-wide Options board: aggregation, active/inactive classification,
derived 2-hour expiry (enforced on accept), search, isolation."""
from datetime import datetime, timedelta, timezone


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company
    return db.query(Company).filter(Company.organization_id == org_id).first()


def _setup(client, db, org_id):
    """Two tendered loads with options + a carrier with contact info."""
    sh = _shipper(db, org_id)
    cid = client.post("/api/carriers", json={
        "name": "Board Trucking", "mc_number": "MC777888",
        "phone": "555-0101", "email": "disp@board.example",
    }).json()["id"]
    l1 = client.post("/api/loads", json={
        "shipper_id": sh.id, "status": "tendered", "customer_rate": "2000",
        "origin_city": "Atlanta", "origin_state": "GA", "dest_city": "Miami", "dest_state": "FL",
    }).json()["id"]
    l2 = client.post("/api/loads", json={
        "shipper_id": sh.id, "status": "tendered", "customer_rate": "1500",
        "origin_city": "Dallas", "origin_state": "TX", "dest_city": "Tulsa", "dest_state": "OK",
    }).json()["id"]
    o1 = client.post(f"/api/loads/{l1}/options", json={"carrier_id": cid, "rate": "1700",
                                                       "notes": "Empty in ATL"}).json()["id"]
    o2 = client.post(f"/api/loads/{l2}/options", json={"carrier_name": "OffSystem LLC",
                                                       "rate": "1300"}).json()["id"]
    return cid, l1, l2, o1, o2


def test_board_aggregates_across_loads_with_context(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, l1, l2, o1, o2 = _setup(client, db, seeded["org_a"])

    rows = client.get("/api/options", params={"view": "active"}).json()
    assert {r["load_id"] for r in rows} == {l1, l2}

    r1 = next(r for r in rows if r["id"] == o1)
    assert r1["load_reference"].startswith("L-")
    assert r1["origin_city"] == "Atlanta" and r1["dest_city"] == "Miami"
    assert r1["carrier_name"] == "Board Trucking"
    assert r1["carrier_phone"] == "555-0101" and r1["carrier_email"] == "disp@board.example"
    assert r1["margin"] == "300.00"          # 2000 − 1700
    assert r1["notes"] == "Empty in ATL"
    assert r1["is_expired"] is False and r1["active"] is True
    assert r1["expires_at"] is not None


def test_expired_and_closed_options_go_inactive(client, seeded, db):
    from app.models import LoadOption
    _login(client, "a@example.com", "password-a")
    cid, l1, l2, o1, o2 = _setup(client, db, seeded["org_a"])

    # Backdate o1 beyond the 2h TTL → expired.
    db.query(LoadOption).filter(LoadOption.id == o1).update(
        {"created_at": datetime.now(timezone.utc) - timedelta(hours=3)})
    db.commit()
    # Decline o2 → closed.
    client.patch(f"/api/loads/{l2}/options/{o2}", json={"status": "declined"})

    active = client.get("/api/options", params={"view": "active"}).json()
    assert active == []
    inactive = client.get("/api/options", params={"view": "inactive"}).json()
    ids = {r["id"] for r in inactive}
    assert ids == {o1, o2}
    assert next(r for r in inactive if r["id"] == o1)["is_expired"] is True


def test_covering_a_load_deactivates_its_options(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, l1, l2, o1, o2 = _setup(client, db, seeded["org_a"])
    client.post(f"/api/loads/{l1}/options/{o1}/accept")

    active_ids = {r["id"] for r in client.get("/api/options", params={"view": "active"}).json()}
    assert o1 not in active_ids          # accepted → inactive
    assert o2 in active_ids              # the other load's option stays live


def test_accept_expired_option_rejected(client, seeded, db):
    from app.models import LoadOption
    _login(client, "a@example.com", "password-a")
    cid, l1, l2, o1, o2 = _setup(client, db, seeded["org_a"])
    db.query(LoadOption).filter(LoadOption.id == o1).update(
        {"created_at": datetime.now(timezone.utc) - timedelta(hours=3)})
    db.commit()

    res = client.post(f"/api/loads/{l1}/options/{o1}/accept")
    assert res.status_code == 410
    assert client.get(f"/api/loads/{l1}").json()["status"] == "tendered"  # untouched


def test_board_search(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, l1, l2, o1, o2 = _setup(client, db, seeded["org_a"])

    assert [r["id"] for r in client.get("/api/options", params={"search": "Dallas"}).json()] == [o2]
    assert [r["id"] for r in client.get("/api/options", params={"search": "Board Truck"}).json()] == [o1]
    assert [r["id"] for r in client.get("/api/options", params={"search": "MC777888"}).json()] == [o1]


def test_board_isolation(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    _setup(client, db, seeded["org_a"])
    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    assert client.get("/api/options", params={"view": "all"}).json() == []
