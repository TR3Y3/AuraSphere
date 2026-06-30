"""Carrier ops — compliance flags, derived lane history, capacity (F3)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def test_compliance_flags(client, seeded):
    _login(client, "a@example.com", "password-a")
    bad = client.post("/api/carriers", json={"name": "No Insurance Co"}).json()
    assert bad["is_compliant"] is False
    assert "No auto liability on file" in bad["compliance_issues"]
    assert "No cargo coverage on file" in bad["compliance_issues"]

    good = client.post("/api/carriers", json={
        "name": "Covered Co", "auto_liability": "1000000", "cargo_coverage": "100000",
    }).json()
    assert good["is_compliant"] is True
    assert good["compliance_issues"] == []

    deact = client.post("/api/carriers", json={
        "name": "Gone Co", "status": "deactivated", "auto_liability": "1000000", "cargo_coverage": "100000",
    }).json()
    assert "Carrier is deactivated" in deact["compliance_issues"]


def test_lane_history_derived_from_loads(client, seeded, db):
    from app.models import Company

    _login(client, "a@example.com", "password-a")
    shipper = db.query(Company).filter(Company.organization_id == seeded["org_a"]).first()
    cid = client.post("/api/carriers", json={"name": "Lane Hauler"}).json()["id"]

    def mk_load(o, d, rate):
        client.post("/api/loads", json={
            "shipper_id": shipper.id, "carrier_id": cid, "equipment": "53' Van",
            "origin_city": o, "origin_state": "GA", "dest_city": d, "dest_state": "FL",
            "carrier_rate": rate,
        })

    mk_load("Atlanta", "Miami", "1000")
    mk_load("Atlanta", "Miami", "1100")  # same lane, 2 shipments
    mk_load("Savannah", "Tampa", "900")

    lanes = client.get(f"/api/carriers/{cid}/lanes").json()
    assert len(lanes) == 2
    top = lanes[0]
    assert top["origin"] == "Atlanta, GA" and top["destination"] == "Miami, FL"
    assert top["shipments"] == 2
    assert top["last_rate"] == "1100.00"  # most recent rate on that lane


def test_capacity_crud(client, seeded):
    _login(client, "a@example.com", "password-a")
    cid = client.post("/api/carriers", json={"name": "Capacity Co"}).json()["id"]
    res = client.post(f"/api/carriers/{cid}/capacity", json={
        "location": "Hialeah, FL", "radius_miles": 25, "weekly_capacity": 4, "equipment": "Dry Van",
    })
    assert res.status_code == 201, res.text
    rows = client.get(f"/api/carriers/{cid}/capacity").json()
    assert len(rows) == 1 and rows[0]["location"] == "Hialeah, FL"
    assert client.delete(f"/api/carriers/{cid}/capacity/{rows[0]['id']}").status_code == 204
    assert client.get(f"/api/carriers/{cid}/capacity").json() == []


def test_carrier_ops_isolation(client, seeded, db):
    from app.models import Carrier

    carrier_b = Carrier(organization_id=seeded["org_b"], name="Org B Carrier")
    db.add(carrier_b)
    db.commit()
    _login(client, "a@example.com", "password-a")
    assert client.get(f"/api/carriers/{carrier_b.id}/lanes").status_code == 404
    assert client.get(f"/api/carriers/{carrier_b.id}/capacity").status_code == 404
