"""Sales coverage: secondary owner on shippers + rep sales codes."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _add_member(db, org_id, email="rep2@example.com", name="Rep Two"):
    from app.models import User
    from app.security import hash_password

    u = User(organization_id=org_id, email=email,
             password_hash=hash_password("password-r"), full_name=name, role="member")
    db.add(u)
    db.commit()
    return u


def test_secondary_owner_set_and_covered_by_my_records(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    rep = _add_member(db, seeded["org_a"])

    created = client.post("/api/companies", json={
        "name": "Covered Foods", "secondary_owner_id": rep.id,
    }).json()
    assert created["secondary_owner_id"] == rep.id

    # The backup rep's "My records" filter includes accounts they back up.
    mine = client.get("/api/companies", params={"owner_id": rep.id}).json()
    assert any(c["name"] == "Covered Foods" for c in mine["items"])

    # Reassignable via update too.
    updated = client.patch(f"/api/companies/{created['id']}", json={"secondary_owner_id": None}).json()
    assert updated["secondary_owner_id"] is None


def test_admin_sets_sales_code_and_it_normalizes(client, seeded, db):
    _login(client, "a@example.com", "password-a")  # owner
    rep = _add_member(db, seeded["org_a"], email="coded@example.com")
    res = client.patch(f"/api/users/{rep.id}", json={"sales_code": " tr-07 "})
    assert res.status_code == 200, res.text
    assert res.json()["sales_code"] == "TR-07"
    # Visible in the org user directory.
    users = client.get("/api/users").json()
    assert any(u["sales_code"] == "TR-07" for u in users)


def test_member_cannot_set_sales_code(client, seeded, db):
    rep = _add_member(db, seeded["org_a"], email="m2@example.com")
    _login(client, "m2@example.com", "password-r")
    assert client.patch(f"/api/users/{rep.id}", json={"sales_code": "X-1"}).status_code == 403


def test_sales_code_is_tenant_scoped(client, seeded, db):
    rep = _add_member(db, seeded["org_a"], email="scoped@example.com")
    _login(client, "b@example.com", "password-b")  # owner of ORG B
    assert client.patch(f"/api/users/{rep.id}", json={"sales_code": "HACK"}).status_code == 404
