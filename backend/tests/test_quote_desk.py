"""Quote Desk — carrier options on a load, accept-to-cover (S1)."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _setup(client, db, org_id):
    from app.models import Carrier, Company

    shipper = db.query(Company).filter(Company.organization_id == org_id).first()
    carrier = Carrier(organization_id=org_id, name="Haulers Inc")
    db.add(carrier)
    db.commit()
    lid = client.post("/api/loads", json={
        "shipper_id": shipper.id, "customer_rate": "1580", "target_rate": "1400",
    }).json()["id"]
    return lid, carrier.id


def test_add_and_list_options(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    res = client.post(f"/api/loads/{lid}/options", json={"carrier_id": cid, "rate": "1420"})
    assert res.status_code == 201, res.text
    assert res.json()["carrier"]["name"] == "Haulers Inc"

    opts = client.get(f"/api/loads/{lid}/options").json()
    assert len(opts) == 1 and opts[0]["rate"] == "1420.00"


def test_accept_option_covers_load(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    oid = client.post(f"/api/loads/{lid}/options", json={"carrier_id": cid, "rate": "1420"}).json()["id"]
    # A second, pricier option that should be declined on accept.
    oid2 = client.post(f"/api/loads/{lid}/options", json={"carrier_name": "Other", "rate": "1500"}).json()["id"]

    res = client.post(f"/api/loads/{lid}/options/{oid}/accept")
    assert res.status_code == 200, res.text
    load = res.json()
    assert load["status"] == "covered"
    assert load["carrier"]["id"] == cid
    assert load["carrier_rate"] == "1420.00"
    assert load["margin"] == "160.00"  # 1580 − 1420

    opts = {o["id"]: o["status"] for o in client.get(f"/api/loads/{lid}/options").json()}
    assert opts[oid] == "accepted"
    assert opts[oid2] == "declined"


def test_counter_rate_wins_on_accept(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    oid = client.post(f"/api/loads/{lid}/options", json={"carrier_id": cid, "rate": "1450"}).json()["id"]
    client.patch(f"/api/loads/{lid}/options/{oid}", json={"counter_rate": "1400", "status": "countered"})
    load = client.post(f"/api/loads/{lid}/options/{oid}/accept").json()
    assert load["carrier_rate"] == "1400.00"


def test_option_carrier_must_be_in_org(client, seeded, db):
    from app.models import Carrier

    carrier_b = Carrier(organization_id=seeded["org_b"], name="Org B Hauler")
    db.add(carrier_b)
    db.commit()
    _login(client, "a@example.com", "password-a")
    lid, _ = _setup(client, db, seeded["org_a"])
    assert client.post(f"/api/loads/{lid}/options", json={"carrier_id": carrier_b.id, "rate": "1"}).status_code == 422


def test_quote_desk_isolation(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    client.post(f"/api/loads/{lid}/options", json={"carrier_id": cid, "rate": "1420"})

    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    # Org B can't even see org A's load, let alone its options.
    assert client.get(f"/api/loads/{lid}/options").status_code == 404


def test_second_accept_conflicts(client, seeded, db):
    """Two reps accepting different options: the loser gets a clean 409 and the
    winner's carrier/rate stick (the double-accept race from the launch audit)."""
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    o1 = client.post(f"/api/loads/{lid}/options", json={"carrier_id": cid, "rate": "1500"}).json()["id"]
    o2 = client.post(f"/api/loads/{lid}/options", json={"carrier_name": "Rival Trucking", "rate": "1400"}).json()["id"]

    assert client.post(f"/api/loads/{lid}/options/{o1}/accept").status_code == 200
    res = client.post(f"/api/loads/{lid}/options/{o2}/accept")
    assert res.status_code == 409
    load = client.get(f"/api/loads/{lid}").json()
    assert load["status"] == "covered"
    assert load["carrier_rate"] == "1500.00"  # winner's rate, not the loser's
    opts = {o["id"]: o["status"] for o in client.get(f"/api/loads/{lid}/options").json()}
    assert opts[o1] == "accepted"
    assert opts[o2] != "accepted"


def test_board_meta_requires_auth(client, seeded):
    assert client.get("/api/loads/board").status_code == 401
