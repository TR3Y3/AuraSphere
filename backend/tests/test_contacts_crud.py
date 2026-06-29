"""Contacts CRUD + company linking + tenant isolation."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _org_company(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_create_and_link_to_company(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    company = _org_company(db, seeded["org_a"])

    res = client.post(
        "/api/contacts",
        json={"first_name": "Jane", "last_name": "Doe", "company_id": company.id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["company"]["id"] == company.id
    assert body["company"]["name"] == company.name


def test_cannot_link_to_other_orgs_company(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    company_b = _org_company(db, seeded["org_b"])

    res = client.post(
        "/api/contacts",
        json={"first_name": "Cross", "company_id": company_b.id},
    )
    assert res.status_code == 422


def test_filter_by_company(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    company = _org_company(db, seeded["org_a"])
    client.post("/api/contacts", json={"first_name": "Linked", "company_id": company.id})
    client.post("/api/contacts", json={"first_name": "Unlinked"})

    res = client.get("/api/contacts", params={"company_id": company.id})
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["first_name"] == "Linked"


def test_contacts_are_org_isolated(client, seeded):
    _login(client, "a@example.com", "password-a")
    client.post("/api/contacts", json={"first_name": "OnlyA"})

    # User B sees none of org A's contacts.
    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    body = client.get("/api/contacts").json()
    assert body["total"] == 0
