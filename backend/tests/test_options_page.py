"""Live options page: MC matching, traffic lights, cover+ratecon, offer lock/expiry, sign."""
from datetime import datetime, timedelta, timezone


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _setup(client, db, org_id, vetted=True):
    from app.models import Carrier, Company

    shipper = db.query(Company).filter(Company.organization_id == org_id).first()
    carrier = Carrier(organization_id=org_id, name="Green Trucking", mc_number="MC777001",
                      dot_number="DOT555", email="dispatch@greentrucking.com",
                      auto_liability=1000000, cargo_coverage=100000, rating=4.5)
    db.add(carrier)
    db.commit()
    if vetted:
        client.post(f"/api/carriers/{carrier.id}/vet")  # stub → clear
    lid = client.post("/api/loads", json={
        "shipper_id": shipper.id, "status": "tendered", "customer_rate": "2000",
        "origin_city": "Savannah", "origin_state": "GA", "dest_city": "Dallas", "dest_state": "TX",
    }).json()["id"]
    return lid, carrier.id


def test_option_mc_match_and_lights(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])

    # MC that matches an in-system carrier → auto-linked, green (vetted clear).
    green = client.post(f"/api/loads/{lid}/options",
                        json={"mc_number": "777001", "rate": "1700"}).json()
    assert green["carrier_id"] == cid
    assert green["carrier_light"] == "green"

    # Unknown MC → grey (not in the system yet).
    grey = client.post(f"/api/loads/{lid}/options",
                       json={"mc_number": "999999", "carrier_name": "Mystery Truck", "rate": "1600"}).json()
    assert grey["carrier_id"] is None
    assert grey["carrier_light"] == "grey"


def test_orange_and_red_lights(client, seeded, db):
    from app.models import Carrier

    _login(client, "a@example.com", "password-a")
    lid, _ = _setup(client, db, seeded["org_a"])

    unvetted = Carrier(organization_id=seeded["org_a"], name="Unvetted Inc", mc_number="MC123")
    deactivated = Carrier(organization_id=seeded["org_a"], name="Dead Inc", mc_number="MC456",
                          status="deactivated")
    db.add_all([unvetted, deactivated])
    db.commit()

    o1 = client.post(f"/api/loads/{lid}/options", json={"carrier_id": unvetted.id}).json()
    assert o1["carrier_light"] == "orange"
    o2 = client.post(f"/api/loads/{lid}/options", json={"carrier_id": deactivated.id}).json()
    assert o2["carrier_light"] == "red"


def test_cover_green_sends_ratecon_and_covers(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    oid = client.post(f"/api/loads/{lid}/options",
                      json={"mc_number": "MC777001", "rate": "1750"}).json()["id"]

    res = client.post(f"/api/loads/{lid}/options/{oid}/cover")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["load"]["status"] == "covered"
    assert body["load"]["carrier_rate"] == "1750.00"
    assert body["sign_url"] and "/sign?token=" in body["sign_url"]  # console mode
    assert body["sent_to"] == "dispatch@greentrucking.com"

    # The carrier can view + sign via the public token (no login).
    token = body["sign_url"].split("token=")[1]
    view = client.get(f"/api/sign/{token}").json()
    assert view["signed"] is False and "RATE CONFIRMATION" in view["html"]
    signed = client.post(f"/api/sign/{token}", json={"signer_name": "Pat Dispatcher"})
    assert signed.status_code == 200 and signed.json()["signed"] is True
    # Single-use.
    assert client.post(f"/api/sign/{token}", json={"signer_name": "Again"}).status_code == 409
    # Signed copy filed under Documents.
    docs = client.get(f"/api/loads/{lid}/documents").json()
    assert any(d["kind"] == "rate_con" for d in docs)


def test_cover_refuses_non_green(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, _ = _setup(client, db, seeded["org_a"])
    grey = client.post(f"/api/loads/{lid}/options",
                       json={"mc_number": "999999", "carrier_name": "Mystery"}).json()["id"]
    res = client.post(f"/api/loads/{lid}/options/{grey}/cover")
    assert res.status_code == 422
    assert "not clear to book" in res.json()["detail"]


def test_offer_locks_load_and_sign_covers(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, cid = _setup(client, db, seeded["org_a"])
    offered = client.post(f"/api/loads/{lid}/options",
                          json={"mc_number": "MC777001", "rate": "1800"}).json()["id"]
    rival = client.post(f"/api/loads/{lid}/options",
                        json={"carrier_name": "Rival", "rate": "1500"}).json()["id"]

    res = client.post(f"/api/loads/{lid}/offer", json={"option_id": offered, "ttl_minutes": 10})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["load"]["status"] == "offered"
    assert body["load"]["offer_expires_at"] is not None

    # Locked: the rival option cannot be accepted while offered.
    assert client.post(f"/api/loads/{lid}/options/{rival}/accept").status_code == 409

    # The offered carrier signs → covered with their rate.
    token = body["sign_url"].split("token=")[1]
    assert client.post(f"/api/sign/{token}", json={"signer_name": "Green Dispatch"}).status_code == 200
    load = client.get(f"/api/loads/{lid}").json()
    assert load["status"] == "covered"
    assert load["carrier_id"] == cid
    assert load["carrier_rate"] == "1800.00"


def test_expired_offer_lazily_reverts_to_tendered(client, seeded, db):
    from app.models import Load

    _login(client, "a@example.com", "password-a")
    lid, _ = _setup(client, db, seeded["org_a"])
    oid = client.post(f"/api/loads/{lid}/options", json={"mc_number": "MC777001"}).json()["id"]
    client.post(f"/api/loads/{lid}/offer", json={"option_id": oid})

    # Force the window into the past, then just READ the load.
    load = db.query(Load).filter(Load.id == lid).first()
    load.offer_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    body = client.get(f"/api/loads/{lid}").json()
    assert body["status"] == "tendered"          # lazily reverted
    assert body["offered_carrier_id"] is None
    # And the stale sign link is dead (410 Gone).


def test_offer_rejects_red_and_missing_carrier(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid, _ = _setup(client, db, seeded["org_a"])
    grey = client.post(f"/api/loads/{lid}/options", json={"carrier_name": "NoMC"}).json()["id"]
    assert client.post(f"/api/loads/{lid}/offer", json={"option_id": grey}).status_code == 422


def test_sign_token_isolation_and_bad_token(client, seeded, db):
    assert client.get("/api/sign/not-a-token").status_code == 404
