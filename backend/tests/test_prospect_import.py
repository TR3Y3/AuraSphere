"""Lead-Gen CSV import + broadened prospect search."""
import io


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _csv(content: str, name="prospects.csv"):
    return {"file": (name, io.BytesIO(content.encode()), "text/csv")}


def test_csv_import_maps_flexible_headers_and_scores(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    # Mixed / aliased headers, one row missing a company name (skipped).
    content = (
        "Company,Website,Industry,City,ST,Contact,Title,Email,Phone\n"
        "Acme Manufacturing,acme.com,Manufacturing,Atlanta,GA,Jane Doe,Logistics Mgr,jane@acme.com,555-1000\n"
        "Globex Distribution,globex.com,Distribution,Dallas,TX,,,,,\n"
        ",noname.com,,,,,,,\n"
    )
    res = client.post("/api/prospects/import", files=_csv(content))
    assert res.status_code == 200, res.text
    assert res.json() == {"created": 2, "skipped": 1}

    items = client.get("/api/prospects").json()["items"]
    names = {p["company_name"] for p in items}
    assert names == {"Acme Manufacturing", "Globex Distribution"}
    acme = next(p for p in items if p["company_name"] == "Acme Manufacturing")
    assert acme["state"] == "GA" and acme["contact_email"] == "jane@acme.com"
    assert acme["freight_fit_score"] >= 80  # manufacturing = strong signal
    assert acme["source"] == "csv_import"


def test_search_matches_city_and_contact(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    client.post("/api/prospects/import", files=_csv(
        "company,city,contact\nFoo Foods,Savannah,Bob Smith\n"))
    assert client.get("/api/prospects", params={"search": "savannah"}).json()["total"] == 1
    assert client.get("/api/prospects", params={"search": "bob"}).json()["total"] == 1


def test_import_is_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    client.post("/api/prospects/import", files=_csv("company\nOrg A Only\n"))
    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.get("/api/prospects").json()["total"] == 0


def test_enrich_fills_empty_contact_fields(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    pid = client.post("/api/prospects", json={
        "company_name": "Acme Mfg", "domain": "acmemfg.com", "contact_name": "Keep Me",
    }).json()["id"]

    p = client.post(f"/api/prospects/{pid}/enrich").json()
    assert p["contact_name"] == "Keep Me"          # never clobbers typed data
    assert p["contact_email"] and p["contact_email"].endswith("@acmemfg.com")
    assert p["contact_title"]
    # Deterministic in stub mode.
    p2 = client.post(f"/api/prospects/{pid}/enrich").json()
    assert p2["contact_email"] == p["contact_email"]


def test_enrich_requires_domain_and_is_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    pid = client.post("/api/prospects", json={"company_name": "No Domain Co"}).json()["id"]
    assert client.post(f"/api/prospects/{pid}/enrich").status_code == 422

    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.post(f"/api/prospects/{pid}/enrich").status_code == 404
