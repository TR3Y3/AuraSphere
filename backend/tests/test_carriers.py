"""Carriers CRUD + tenant isolation + contact→carrier linking (freight F1)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def test_carrier_crud_cycle(client, seeded):
    _login(client, "a@example.com", "password-a")
    created = client.post(
        "/api/carriers",
        json={"name": "Belgian Transport LLC", "mc_number": "1494541", "hq_state": "SC", "rating": "3.2"},
    )
    assert created.status_code == 201, created.text
    cid = created.json()["id"]
    assert created.json()["owner_id"] is not None

    patched = client.patch(f"/api/carriers/{cid}", json={"on_time_pct": 88, "status": "deactivated"})
    assert patched.status_code == 200
    assert patched.json()["on_time_pct"] == 88
    assert patched.json()["status"] == "deactivated"

    assert client.delete(f"/api/carriers/{cid}").status_code == 204
    assert client.get(f"/api/carriers/{cid}").status_code == 404


def test_carrier_list_search(client, seeded):
    _login(client, "a@example.com", "password-a")
    client.post("/api/carriers", json={"name": "Alpha Freight", "mc_number": "111"})
    client.post("/api/carriers", json={"name": "Beta Logistics", "mc_number": "222"})
    res = client.get("/api/carriers", params={"search": "Alpha"})
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Alpha Freight"


def test_carrier_tenant_isolation(client, seeded):
    _login(client, "a@example.com", "password-a")
    cid = client.post("/api/carriers", json={"name": "Org A Carrier"}).json()["id"]

    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    assert client.get(f"/api/carriers/{cid}").status_code == 404
    assert client.get("/api/carriers").json()["total"] == 0


def test_contact_links_to_carrier(client, seeded):
    _login(client, "a@example.com", "password-a")
    cid = client.post("/api/carriers", json={"name": "Haulers Inc"}).json()["id"]
    res = client.post(
        "/api/contacts",
        json={"first_name": "Dispatch", "last_name": "Joe", "carrier_id": cid},
    )
    assert res.status_code == 201, res.text
    assert res.json()["carrier"]["id"] == cid
    assert res.json()["carrier"]["name"] == "Haulers Inc"


def test_contact_cannot_link_other_orgs_carrier(client, seeded, db):
    from app.models import Carrier

    carrier_b = Carrier(organization_id=seeded["org_b"], name="Org B Hauler")
    db.add(carrier_b)
    db.commit()

    _login(client, "a@example.com", "password-a")
    res = client.post(
        "/api/contacts", json={"first_name": "Cross", "carrier_id": carrier_b.id}
    )
    assert res.status_code == 422
