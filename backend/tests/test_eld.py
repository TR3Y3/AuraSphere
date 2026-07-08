"""ELD sync: creates progressing GPS check-calls, status, isolation."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def _load(client, db, org_id):
    sh = _shipper(db, org_id)
    cid = client.post("/api/carriers", json={"name": "ELD Trucking"}).json()["id"]
    return client.post("/api/loads", json={
        "shipper_id": sh.id, "status": "dispatched", "carrier_id": cid, "total_miles": 1000,
        "origin_city": "Rincon", "origin_state": "GA", "dest_city": "Dallas", "dest_state": "TX",
    }).json()["id"]


def test_sync_creates_gps_checkcall(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    res = client.post(f"/api/loads/{lid}/eld/sync")
    assert res.status_code == 201, res.text
    cc = res.json()
    assert cc["latitude"] is not None and cc["longitude"] is not None
    assert "ELD" in cc["status_note"]
    assert cc["eta"] is not None  # miles set → ETA computed

    # It shows up in the tracking history.
    calls = client.get(f"/api/loads/{lid}/checkcalls").json()
    assert len(calls) == 1


def test_sync_advances_position(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    first = client.post(f"/api/loads/{lid}/eld/sync").json()
    second = client.post(f"/api/loads/{lid}/eld/sync").json()
    # Second ping progresses further along the lane (position moves).
    assert (first["latitude"], first["longitude"]) != (second["latitude"], second["longitude"])
    assert len(client.get(f"/api/loads/{lid}/checkcalls").json()) == 2


def test_eld_status_reports_demo_in_stub(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    s = client.get(f"/api/loads/{lid}/eld/status").json()
    assert s["connected"] is False
    assert s["provider"] == "demo"


def test_eld_is_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.post(f"/api/loads/{lid}/eld/sync").status_code == 404
    assert client.get(f"/api/loads/{lid}/eld/status").status_code == 404
