"""Carrier portal: token auth, carrier/org scoping, no customer-rate leakage,
offers land as carrier_app options, paperwork upload, GPS pings, revocation."""
import io


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _setup(client, db, org_id):
    """A carrier with a portal link + one open (tendered) load + one assigned load."""
    from app.models import Company

    shipper = db.query(Company).filter(Company.organization_id == org_id).first()
    cid = client.post("/api/carriers", json={
        "name": "Portal Trucking", "mc_number": "MC321654", "email": "d@portal.example",
    }).json()["id"]
    url = client.post(f"/api/carriers/{cid}/portal-link").json()["url"]
    token = url.split("token=")[1]

    open_load = client.post("/api/loads", json={
        "shipper_id": shipper.id, "status": "tendered", "customer_rate": "2500",
        "origin_city": "Atlanta", "origin_state": "GA", "dest_city": "Miami", "dest_state": "FL",
        "equipment": "Reefer", "total_miles": 660,
    }).json()
    mine = client.post("/api/loads", json={
        "shipper_id": shipper.id, "status": "covered", "carrier_id": cid,
        "customer_rate": "1800", "carrier_rate": "1500",
        "origin_city": "Savannah", "origin_state": "GA", "dest_city": "Tampa", "dest_state": "FL",
    }).json()
    return cid, token, open_load["id"], mine["id"]


def test_portal_meta_and_available_loads_hide_customer_side(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, token, open_id, _ = _setup(client, db, seeded["org_a"])

    meta = client.get("/api/portal/meta", params={"token": token}).json()
    assert meta["carrier_name"] == "Portal Trucking"
    assert meta["org_name"]

    loads = client.get("/api/portal/loads/available", params={"token": token}).json()
    assert any(l["id"] == open_id for l in loads)
    board = next(l for l in loads if l["id"] == open_id)
    # The carrier-safe shape must NEVER carry the customer side.
    assert "customer_rate" not in board and "margin" not in board and "shipper" not in board
    assert board["equipment"] == "Reefer"


def test_offer_lands_as_carrier_app_option(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, token, open_id, _ = _setup(client, db, seeded["org_a"])

    res = client.post(f"/api/portal/loads/{open_id}/offer", params={"token": token},
                      json={"rate": "1950", "notes": "Empty in ATL now"})
    assert res.status_code == 201, res.text

    opts = client.get(f"/api/loads/{open_id}/options").json()
    assert len(opts) == 1
    o = opts[0]
    assert o["source"] == "carrier_app"
    assert o["carrier_id"] == cid
    assert o["rate"] == "1950.00"


def test_my_loads_show_carrier_pay_and_docs_upload(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, token, _, mine_id = _setup(client, db, seeded["org_a"])

    mine = client.get("/api/portal/loads/mine", params={"token": token}).json()
    assert [l["id"] for l in mine] == [mine_id]
    assert mine[0]["carrier_rate"] == "1500.00"
    assert "customer_rate" not in mine[0]

    up = client.post(f"/api/portal/loads/{mine_id}/documents", params={"token": token},
                     files={"file": ("pod.pdf", io.BytesIO(b"%PDF pod"), "application/pdf")},
                     data={"kind": "pod"})
    assert up.status_code == 201, up.text
    docs = client.get(f"/api/loads/{mine_id}/documents").json()
    assert any(d["kind"] == "pod" and d["filename"] == "pod.pdf" for d in docs)

    # Cannot upload onto a load that isn't theirs.
    other = client.get("/api/portal/loads/available", params={"token": token}).json()[0]["id"]
    denied = client.post(f"/api/portal/loads/{other}/documents", params={"token": token},
                         files={"file": ("x.pdf", io.BytesIO(b"x"), "application/pdf")},
                         data={"kind": "pod"})
    assert denied.status_code == 404


def test_gps_ping_feeds_tracking(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    _, token, _, mine_id = _setup(client, db, seeded["org_a"])

    res = client.post(f"/api/portal/loads/{mine_id}/ping", params={"token": token},
                      json={"latitude": 31.15, "longitude": -81.49, "city": "Brunswick", "state": "ga"})
    assert res.status_code == 201
    calls = client.get(f"/api/loads/{mine_id}/checkcalls").json()
    assert calls[0]["status_note"] == "Carrier app GPS"
    assert calls[0]["state"] == "GA"
    assert calls[0]["latitude"] is not None


def test_bad_token_revocation_and_deactivation(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, token, _, _ = _setup(client, db, seeded["org_a"])

    assert client.get("/api/portal/meta", params={"token": "bogus"}).status_code == 404

    # Revoke → link dies.
    client.delete(f"/api/carriers/{cid}/portal-link")
    assert client.get("/api/portal/meta", params={"token": token}).status_code == 404
    assert client.get(f"/api/carriers/{cid}").json()["portal_enabled"] is False

    # Regenerate → new link works, deactivating the carrier blocks it (403).
    token2 = client.post(f"/api/carriers/{cid}/portal-link").json()["url"].split("token=")[1]
    assert client.get("/api/portal/meta", params={"token": token2}).status_code == 200
    client.patch(f"/api/carriers/{cid}", json={"status": "deactivated"})
    assert client.get("/api/portal/meta", params={"token": token2}).status_code == 403


def test_portal_scoped_to_own_org(client, seeded, db):
    """A carrier's portal token must never see another org's loads."""
    from app.models import Company, Load

    _login(client, "a@example.com", "password-a")
    _, token, _, _ = _setup(client, db, seeded["org_a"])

    # Org B has a tendered load; org A's carrier token must not see it.
    shipper_b = db.query(Company).filter(Company.organization_id == seeded["org_b"]).first()
    db.add(Load(organization_id=seeded["org_b"], shipper_id=shipper_b.id, status="tendered"))
    db.commit()

    avail = client.get("/api/portal/loads/available", params={"token": token}).json()
    from app.models import Load as L
    b_ids = {l.id for l in db.query(L).filter(L.organization_id == seeded["org_b"]).all()}
    assert not any(l["id"] in b_ids for l in avail)
