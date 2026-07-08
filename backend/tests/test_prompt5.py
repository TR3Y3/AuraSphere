"""Prompt 5: cover-requires-carrier guard, uncover + reason codes, the load
feed (system events, read-only), and @mention notifications."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company
    return db.query(Company).filter(Company.organization_id == org_id).first()


def _covered_load(client, db, org_id):
    """A carrier + a load covered with it."""
    sh = _shipper(db, org_id)
    cid = client.post("/api/carriers", json={"name": "Guard Trucking"}).json()["id"]
    lid = client.post("/api/loads", json={
        "shipper_id": sh.id, "carrier_id": cid, "status": "covered",
        "carrier_rate": "1500", "customer_rate": "1900",
    }).json()["id"]
    return cid, lid


# ── Item 1: cover requires a carrier ─────────────────────────────────────


def test_cannot_cover_without_carrier(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id, "status": "tendered"}).json()["id"]

    for target in ("covered", "dispatched", "delivered"):
        r = client.patch(f"/api/loads/{lid}/status", json={"status": target})
        assert r.status_code == 422, target
        assert "carrier" in r.json()["detail"].lower()

    # Creating directly in a booked status without a carrier is blocked too.
    r = client.post("/api/loads", json={"shipper_id": sh.id, "status": "covered"})
    assert r.status_code == 422


def test_cover_with_carrier_in_same_patch_succeeds(client, seeded, db):
    """PATCH that assigns the carrier and covers in one call must pass —
    the guard sees the incoming carrier, not just the stored one."""
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    cid = client.post("/api/carriers", json={"name": "OneCall Trucking"}).json()["id"]
    lid = client.post("/api/loads", json={"shipper_id": sh.id, "status": "tendered"}).json()["id"]

    r = client.patch(f"/api/loads/{lid}", json={"carrier_id": cid, "status": "covered"})
    assert r.status_code == 200 and r.json()["status"] == "covered"

    # And removing the carrier while setting a booked status is blocked.
    r2 = client.patch(f"/api/loads/{lid}", json={"carrier_id": None, "status": "dispatched"})
    assert r2.status_code == 422


# ── Item 4: uncover with reason ──────────────────────────────────────────


def test_uncover_reverts_to_tendered_and_logs_reason(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, lid = _covered_load(client, db, seeded["org_a"])

    r = client.post(f"/api/loads/{lid}/uncover", json={"reason": "Bounced", "note": "No show at pickup"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "tendered"
    assert body["carrier_id"] is None and body["carrier_rate"] is None

    feed = client.get("/api/activities", params={"related_load_id": lid}).json()["items"]
    ev = next(a for a in feed if a["event_type"] == "uncovered")
    assert "Bounced" in ev["subject"] and "Guard Trucking" in ev["subject"]
    assert ev["body"] == "No show at pickup"
    assert ev["meta"]["reason"] == "Bounced"


def test_uncover_validations(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, lid = _covered_load(client, db, seeded["org_a"])

    assert client.post(f"/api/loads/{lid}/uncover", json={"reason": "Vibes"}).status_code == 422
    # "Other" requires a note.
    assert client.post(f"/api/loads/{lid}/uncover", json={"reason": "Other"}).status_code == 422
    assert client.post(f"/api/loads/{lid}/uncover",
                       json={"reason": "Other", "note": "Shipper cancelled"}).status_code == 200

    # Not uncoverable once back on tendered (or from quote).
    assert client.post(f"/api/loads/{lid}/uncover", json={"reason": "Bounced"}).status_code == 422


def test_uncover_declines_accepted_option(client, seeded, db):
    """Uncovering steps the Quote Desk's winning option back down."""
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    cid = client.post("/api/carriers", json={"name": "Option Trucking"}).json()["id"]
    lid = client.post("/api/loads", json={"shipper_id": sh.id, "status": "tendered",
                                          "customer_rate": "2000"}).json()["id"]
    oid = client.post(f"/api/loads/{lid}/options", json={"carrier_id": cid, "rate": "1700"}).json()["id"]
    assert client.post(f"/api/loads/{lid}/options/{oid}/accept").status_code == 200

    assert client.post(f"/api/loads/{lid}/uncover", json={"reason": "Rate Dispute"}).status_code == 200
    opts = client.get(f"/api/loads/{lid}/options").json()
    assert opts[0]["status"] == "declined"


def test_uncover_isolation(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    _, lid = _covered_load(client, db, seeded["org_a"])
    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    assert client.post(f"/api/loads/{lid}/uncover", json={"reason": "Bounced"}).status_code == 404


# ── Item 5: feed system events ───────────────────────────────────────────


def test_status_change_posts_feed_event(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    cid, lid = _covered_load(client, db, seeded["org_a"])
    client.patch(f"/api/loads/{lid}/status", json={"status": "dispatched"})

    feed = client.get("/api/activities", params={"related_load_id": lid}).json()["items"]
    subjects = [a["subject"] for a in feed if a["kind"] == "system"]
    assert any("Covered" in s and "Dispatched" in s for s in subjects)
    assert any(s == "Load created" for s in subjects)


def test_carrier_change_posts_feed_event(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    cid = client.post("/api/carriers", json={"name": "Swap Trucking"}).json()["id"]
    lid = client.post("/api/loads", json={"shipper_id": sh.id, "status": "tendered"}).json()["id"]
    client.patch(f"/api/loads/{lid}", json={"carrier_id": cid})

    feed = client.get("/api/activities", params={"related_load_id": lid}).json()["items"]
    assert any(a["event_type"] == "carrier_assigned" and "Swap Trucking" in a["subject"]
               for a in feed)


def test_system_rows_are_read_only(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    _, lid = _covered_load(client, db, seeded["org_a"])
    feed = client.get("/api/activities", params={"related_load_id": lid}).json()["items"]
    sys_row = next(a for a in feed if a["kind"] == "system")

    assert client.patch(f"/api/activities/{sys_row['id']}", json={"subject": "haha"}).status_code == 403
    assert client.delete(f"/api/activities/{sys_row['id']}").status_code == 403


def test_document_upload_posts_feed_event(client, seeded, db):
    import io
    _login(client, "a@example.com", "password-a")
    _, lid = _covered_load(client, db, seeded["org_a"])
    up = client.post(f"/api/loads/{lid}/documents",
                     files={"file": ("bol.pdf", io.BytesIO(b"%PDF bol"), "application/pdf")},
                     data={"kind": "bol"})
    assert up.status_code == 201
    feed = client.get("/api/activities", params={"related_load_id": lid}).json()["items"]
    assert any(a["event_type"] == "doc_uploaded" and "bol.pdf" in a["subject"] for a in feed)


# ── Item 5: mentions ─────────────────────────────────────────────────────


def test_mentions_flow(client, seeded, db):
    from app.models import User
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])
    lid = client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]
    me = client.get("/api/auth/me").json()["user"]["id"]

    r = client.post("/api/activities", json={
        "type": "note", "subject": "Check this rate", "related_load_id": lid,
        "mentions": [me],
    })
    assert r.status_code == 201 and r.json()["mentions"] == [me]

    unseen = client.get("/api/activities/mentions/unseen").json()
    assert unseen["total"] == 1 and unseen["items"][0]["subject"] == "Check this rate"

    assert client.post("/api/activities/mentions/seen").status_code == 200
    assert client.get("/api/activities/mentions/unseen").json()["total"] == 0

    # Cross-org user ids are rejected.
    other = db.query(User).filter(User.organization_id == seeded["org_b"]).first()
    bad = client.post("/api/activities", json={"type": "note", "subject": "x",
                                               "mentions": [other.id]})
    assert bad.status_code == 422
