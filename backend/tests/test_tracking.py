"""Check-calls / tracking: log, list-newest-first, status auto-advance, isolation."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def _load(client, db, org_id):
    sh = _shipper(db, org_id)
    return client.post("/api/loads", json={"shipper_id": sh.id, "status": "dispatched"}).json()["id"]


def test_log_and_list_newest_first(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])

    client.post(f"/api/loads/{lid}/checkcalls", json={
        "city": "Atlanta", "state": "GA", "status_note": "Picked up",
        "reported_at": "2026-06-30T12:00:00Z",
    })
    second = client.post(f"/api/loads/{lid}/checkcalls", json={
        "city": "Birmingham", "state": "AL", "status_note": "Rolling",
        "reported_at": "2026-06-30T15:00:00Z", "eta": "2026-07-01T09:00:00Z",
    })
    assert second.status_code == 201, second.text

    calls = client.get(f"/api/loads/{lid}/checkcalls").json()
    assert len(calls) == 2
    # Newest reported first.
    assert calls[0]["city"] == "Birmingham"
    assert calls[0]["eta"] is not None
    assert calls[1]["city"] == "Atlanta"


def test_check_call_can_advance_load_status(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])

    res = client.post(f"/api/loads/{lid}/checkcalls", json={
        "city": "Dallas", "state": "TX", "status_note": "Delivered",
        "advance_status": "delivered",
    })
    assert res.status_code == 201, res.text
    load = client.get(f"/api/loads/{lid}").json()
    assert load["status"] == "delivered"
    assert load["delivered_at"] is not None


def test_invalid_advance_status_rejected(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    res = client.post(f"/api/loads/{lid}/checkcalls", json={
        "city": "Nowhere", "advance_status": "bogus",
    })
    assert res.status_code == 422
    # No check-call persisted on a failed advance.
    assert client.get(f"/api/loads/{lid}/checkcalls").json() == []


def test_delete_check_call(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    cid = client.post(f"/api/loads/{lid}/checkcalls", json={"city": "Memphis"}).json()["id"]
    assert client.delete(f"/api/loads/{lid}/checkcalls/{cid}").status_code == 204
    assert client.get(f"/api/loads/{lid}/checkcalls").json() == []


def test_tracking_is_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    cid = client.post(f"/api/loads/{lid}/checkcalls", json={"city": "Reno"}).json()["id"]

    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.get(f"/api/loads/{lid}/checkcalls").status_code == 404
    assert client.post(f"/api/loads/{lid}/checkcalls", json={"city": "X"}).status_code == 404
    assert client.delete(f"/api/loads/{lid}/checkcalls/{cid}").status_code == 404
