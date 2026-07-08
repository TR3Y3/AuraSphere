"""Activities + timeline — logging, completion, filters, isolation (F4)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_log_note_on_shipper(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    res = client.post("/api/activities", json={
        "type": "note", "subject": "Intro call", "body": "Spoke with ops.", "related_company_id": sh.id,
    })
    assert res.status_code == 201, res.text
    assert res.json()["owner_id"] is not None

    # Shows up on that shipper's timeline.
    feed = client.get("/api/activities", params={"related_company_id": sh.id}).json()
    assert feed["total"] == 1 and feed["items"][0]["subject"] == "Intro call"


def test_task_completion_toggles_completed_at(client, seeded):
    _login(client, "a@example.com", "password-a")
    tid = client.post("/api/activities", json={
        "type": "task", "subject": "Call carrier back", "due_at": "2026-07-02T15:00:00Z",
    }).json()["id"]

    assert client.get("/api/activities", params={"open_tasks": True}).json()["total"] == 1
    done = client.patch(f"/api/activities/{tid}", json={"completed": True}).json()
    assert done["completed_at"] is not None
    assert client.get("/api/activities", params={"open_tasks": True}).json()["total"] == 0
    # Re-open it.
    reopened = client.patch(f"/api/activities/{tid}", json={"completed": False}).json()
    assert reopened["completed_at"] is None


def test_invalid_type_rejected(client, seeded):
    _login(client, "a@example.com", "password-a")
    assert client.post("/api/activities", json={"type": "carrier_pigeon"}).status_code == 422


def test_related_record_must_be_in_org(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh_b = _shipper(db, seeded["org_b"])
    assert client.post("/api/activities", json={"type": "note", "related_company_id": sh_b.id}).status_code == 422


def test_filter_by_load_and_type(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]
    client.post("/api/activities", json={"type": "call", "subject": "Dispatch", "related_load_id": lid})
    client.post("/api/activities", json={"type": "note", "subject": "Misc"})

    # The load feed = the user's call + the auto-posted "created" system event.
    feed = client.get("/api/activities", params={"related_load_id": lid}).json()
    assert feed["total"] == 2
    assert {a["kind"] for a in feed["items"]} == {"user", "system"}
    assert client.get("/api/activities", params={"type": "call"}).json()["total"] == 1


def test_activity_isolation(client, seeded):
    _login(client, "a@example.com", "password-a")
    client.post("/api/activities", json={"type": "note", "subject": "Org A only"})

    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    assert client.get("/api/activities").json()["total"] == 0
