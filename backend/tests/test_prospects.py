"""Shipper Lead-Gen prospects — scoring, dedupe, convert, isolation (S2)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def test_freight_fit_scored_on_create(client, seeded):
    _login(client, "a@example.com", "password-a")
    strong = client.post("/api/prospects", json={"company_name": "Acme Manufacturing", "industry": "Manufacturing"}).json()
    assert strong["freight_fit_score"] >= 80
    weak = client.post("/api/prospects", json={"company_name": "Bob's Brokerage", "industry": "Freight Broker"}).json()
    assert weak["freight_fit_score"] <= 20  # competitor


def test_dedupe_flags_existing_shipper(client, seeded):
    _login(client, "a@example.com", "password-a")
    client.post("/api/companies", json={"name": "Globex Foods", "domain": "globex.com"})
    p = client.post("/api/prospects", json={"company_name": "Globex Foods", "domain": "globex.com", "industry": "Food"}).json()
    assert p["duplicate_of"] is not None
    assert p["duplicate_of"]["name"] == "Globex Foods"


def test_convert_creates_shipper_and_contact(client, seeded):
    _login(client, "a@example.com", "password-a")
    pid = client.post("/api/prospects", json={
        "company_name": "Initech Distribution", "industry": "Distribution",
        "contact_name": "Jane Doe", "contact_title": "Logistics Manager", "contact_email": "jane@initech.com",
    }).json()["id"]

    res = client.post(f"/api/prospects/{pid}/convert")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "imported"
    assert body["shipper_id"] is not None
    assert body["contact_id"] is not None

    # The shipper + contact now exist in the CRM.
    shippers = client.get("/api/companies", params={"search": "Initech"}).json()
    assert shippers["total"] == 1
    contacts = client.get("/api/contacts", params={"search": "Jane"}).json()
    assert contacts["total"] == 1
    assert contacts["items"][0]["company"]["name"] == "Initech Distribution"


def test_double_convert_conflicts(client, seeded):
    _login(client, "a@example.com", "password-a")
    pid = client.post("/api/prospects", json={"company_name": "OnceOnly Inc", "industry": "Wholesale"}).json()["id"]
    assert client.post(f"/api/prospects/{pid}/convert").status_code == 200
    assert client.post(f"/api/prospects/{pid}/convert").status_code == 409


def test_dismiss_and_filter(client, seeded):
    _login(client, "a@example.com", "password-a")
    pid = client.post("/api/prospects", json={"company_name": "Maybe Co", "industry": "Retail"}).json()["id"]
    client.patch(f"/api/prospects/{pid}", json={"status": "dismissed"})
    assert client.get("/api/prospects", params={"status": "dismissed"}).json()["total"] == 1
    assert client.get("/api/prospects", params={"status": "new"}).json()["total"] == 0


def test_prospect_isolation(client, seeded):
    _login(client, "a@example.com", "password-a")
    client.post("/api/prospects", json={"company_name": "Org A Prospect", "industry": "Food"})

    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    assert client.get("/api/prospects").json()["total"] == 0
