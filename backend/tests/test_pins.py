"""Dashboard pins — per-user, org-scoped, entity resolution + reminders."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_pin_a_shipper_resolves_label_and_link(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    res = client.post("/api/pins", json={
        "entity_type": "shipper", "entity_id": sh.id, "note": "Call back Tuesday",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["label"] == sh.name
    assert body["link"] == f"/companies/{sh.id}"
    assert body["note"] == "Call back Tuesday"


def test_pin_with_reminder_and_list(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    client.post("/api/pins", json={
        "entity_type": "shipper", "entity_id": sh.id, "remind_at": "2026-07-01T15:00:00Z",
    })
    pins = client.get("/api/pins").json()
    assert len(pins) == 1
    assert pins[0]["remind_at"] is not None


def test_pin_dedupes_same_entity(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    client.post("/api/pins", json={"entity_type": "shipper", "entity_id": sh.id})
    client.post("/api/pins", json={"entity_type": "shipper", "entity_id": sh.id, "note": "updated"})
    pins = client.get("/api/pins").json()
    assert len(pins) == 1
    assert pins[0]["note"] == "updated"


def test_cannot_pin_other_orgs_entity(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh_b = _shipper(db, seeded["org_b"])
    assert client.post("/api/pins", json={"entity_type": "shipper", "entity_id": sh_b.id}).status_code == 422


def test_pins_are_per_user(client, seeded, db):
    from app.models import User
    from app.security import hash_password

    member = User(organization_id=seeded["org_a"], email="m-a@example.com",
                  password_hash=hash_password("pw"), full_name="Member A", role="member")
    db.add(member)
    db.commit()
    sh = _shipper(db, seeded["org_a"])

    _login(client, "a@example.com", "password-a")
    client.post("/api/pins", json={"entity_type": "shipper", "entity_id": sh.id})
    assert len(client.get("/api/pins").json()) == 1

    # A different user in the same org sees none of the first user's pins.
    client.cookies.clear()
    _login(client, "m-a@example.com", "pw")
    assert client.get("/api/pins").json() == []


def test_unpin(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    pid = client.post("/api/pins", json={"entity_type": "shipper", "entity_id": sh.id}).json()["id"]
    assert client.delete(f"/api/pins/{pid}").status_code == 204
    assert client.get("/api/pins").json() == []
