"""Loads CRUD, margin math, status workflow, and tenant isolation (F2)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_create_defaults_to_quote_and_sets_reference(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    res = client.post("/api/loads", json={
        "shipper_id": sh.id, "commodity": "Dry Goods", "equipment": "53' Van",
        "origin_city": "Rincon", "origin_state": "GA",
        "dest_city": "San Antonio", "dest_state": "TX",
        "customer_rate": "1580.00", "carrier_rate": "1420.00",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "quote"
    assert body["reference"] is not None
    assert body["shipper"]["id"] == sh.id


def test_margin_is_derived(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    body = client.post("/api/loads", json={
        "shipper_id": sh.id, "customer_rate": "1580.00", "carrier_rate": "1420.00",
    }).json()
    assert body["margin"] == "160.00"

    # Margin is None until both rates exist.
    body2 = client.post("/api/loads", json={"shipper_id": sh.id, "customer_rate": "1000"}).json()
    assert body2["margin"] is None


def test_status_change_persists_and_stamps_delivered(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]

    r = client.patch(f"/api/loads/{lid}/status", json={"status": "covered"})
    assert r.status_code == 200 and r.json()["status"] == "covered"

    r2 = client.patch(f"/api/loads/{lid}/status", json={"status": "delivered"})
    assert r2.json()["status"] == "delivered"
    assert r2.json()["delivered_at"] is not None
    # Survives refetch.
    assert client.get(f"/api/loads/{lid}").json()["status"] == "delivered"


def test_invalid_status_rejected(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]
    assert client.patch(f"/api/loads/{lid}/status", json={"status": "bogus"}).status_code == 422


def test_cannot_link_other_orgs_shipper(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh_b = _shipper(db, seeded["org_b"])
    assert client.post("/api/loads", json={"shipper_id": sh_b.id}).status_code == 422


def test_board_meta_lists_pipeline(client, seeded):
    _login(client, "a@example.com", "password-a")
    body = client.get("/api/loads/board").json()
    assert body["pipeline"][0] == "quote"
    assert "delivered" in body["pipeline"]
    assert "lost" in body["statuses"]


def test_duplicate_rebooks_as_fresh_quote(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    src = client.post("/api/loads", json={
        "shipper_id": sh.id, "commodity": "Steel", "equipment": "Flatbed",
        "origin_city": "Houston", "origin_state": "TX",
        "customer_rate": "2000.00", "carrier_rate": "1700.00", "status": "delivered",
    }).json()

    res = client.post(f"/api/loads/{src['id']}/duplicate")
    assert res.status_code == 201, res.text
    dup = res.json()
    assert dup["id"] != src["id"]
    assert dup["status"] == "quote"
    assert dup["reference"] != src["reference"]
    assert dup["commodity"] == "Steel"
    assert dup["customer_rate"] == "2000.00"
    # Carrier-side data is dropped on a re-book.
    assert dup["carrier_id"] is None
    assert dup["carrier_rate"] is None


def test_load_isolation(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]

    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    assert client.get(f"/api/loads/{lid}").status_code == 404
    assert client.patch(f"/api/loads/{lid}/status", json={"status": "covered"}).status_code == 404
    assert client.get("/api/loads").json()["total"] == 0
