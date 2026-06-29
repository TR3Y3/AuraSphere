"""Companies CRUD + list filtering + ownership + tenant isolation."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def test_full_crud_cycle(client, seeded):
    _login(client, "a@example.com", "password-a")

    created = client.post("/api/companies", json={"name": "Initech", "industry": "Software"})
    assert created.status_code == 201, created.text
    cid = created.json()["id"]
    assert created.json()["owner_id"] is not None  # defaults to creator

    got = client.get(f"/api/companies/{cid}")
    assert got.status_code == 200
    assert got.json()["name"] == "Initech"

    patched = client.patch(f"/api/companies/{cid}", json={"name": "Initech LLC"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Initech LLC"

    assert client.delete(f"/api/companies/{cid}").status_code == 204
    assert client.get(f"/api/companies/{cid}").status_code == 404


def test_list_search_and_pagination(client, seeded):
    _login(client, "a@example.com", "password-a")
    for i in range(3):
        client.post("/api/companies", json={"name": f"Search Co {i}"})

    res = client.get("/api/companies", params={"search": "Search Co", "page_size": 2})
    body = res.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["page_size"] == 2


def test_member_cannot_edit_others_record(client, seeded, db):
    # Add a member in org A who does not own the seeded company.
    from app.models import Company, User
    from app.security import hash_password

    member = User(
        organization_id=seeded["org_a"],
        email="member-a@example.com",
        password_hash=hash_password("pw"),
        full_name="Member A",
        role="member",
    )
    db.add(member)
    db.commit()

    company = db.query(Company).filter(Company.organization_id == seeded["org_a"]).first()

    _login(client, "member-a@example.com", "pw")
    # Member can see it...
    assert client.get(f"/api/companies/{company.id}").status_code == 200
    # ...but cannot edit a record they don't own.
    assert client.patch(
        f"/api/companies/{company.id}", json={"name": "Hijack"}
    ).status_code == 403


def test_cannot_access_other_orgs_company(client, seeded, db):
    from app.models import Company

    company_b = db.query(Company).filter(
        Company.organization_id == seeded["org_b"]
    ).first()

    _login(client, "a@example.com", "password-a")
    # Org B's company is invisible to org A — 404, not 403.
    assert client.get(f"/api/companies/{company_b.id}").status_code == 404
    assert client.patch(
        f"/api/companies/{company_b.id}", json={"name": "x"}
    ).status_code == 404
    assert client.delete(f"/api/companies/{company_b.id}").status_code == 404
