"""New list filters on loads and carriers."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_load_filters(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sid = _shipper(db, seeded["org_a"]).id
    client.post("/api/loads", json={"shipper_id": sid, "equipment": "Reefer",
                                     "origin_state": "GA", "dest_state": "TX"})
    client.post("/api/loads", json={"shipper_id": sid, "equipment": "Dry Van",
                                     "origin_state": "FL", "dest_state": "TX", "post_to_dat": True})

    assert client.get("/api/loads", params={"equipment": "reefer"}).json()["total"] == 1
    assert client.get("/api/loads", params={"origin_state": "ga"}).json()["total"] == 1
    assert client.get("/api/loads", params={"dest_state": "TX"}).json()["total"] == 2
    assert client.get("/api/loads", params={"posted_to_dat": "true"}).json()["total"] == 1
    assert client.get("/api/loads", params={"posted_to_dat": "false"}).json()["total"] == 1


def test_carrier_filters(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    client.post("/api/carriers", json={"name": "TN Reefer Co", "hq_state": "TN",
                                        "equipment_types": "Reefer, Van", "rating": "4.5"})
    client.post("/api/carriers", json={"name": "GA Flatbed Co", "hq_state": "GA",
                                        "equipment_types": "Flatbed", "rating": "2.0"})

    assert client.get("/api/carriers", params={"hq_state": "tn"}).json()["total"] == 1
    assert client.get("/api/carriers", params={"equipment": "reefer"}).json()["total"] == 1
    assert client.get("/api/carriers", params={"min_rating": 4.0}).json()["total"] == 1
