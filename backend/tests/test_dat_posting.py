"""DAT load-board posting: post/unpost, auto-post on create, isolation."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_post_and_remove_dat(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]
    assert client.get(f"/api/loads/{lid}").json()["posted_to_dat"] is False

    posted = client.post(f"/api/loads/{lid}/dat-post").json()
    assert posted["posted_to_dat"] is True
    assert posted["dat_posting_id"]
    assert posted["dat_posted_at"] is not None

    removed = client.request("DELETE", f"/api/loads/{lid}/dat-post").json()
    assert removed["posted_to_dat"] is False
    assert removed["dat_posting_id"] is None


def test_auto_post_on_create(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    res = client.post("/api/loads", json={"shipper_id": sh.id, "post_to_dat": True})
    assert res.status_code == 201
    assert res.json()["posted_to_dat"] is True


def test_dat_post_is_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]
    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.post(f"/api/loads/{lid}/dat-post").status_code == 404
