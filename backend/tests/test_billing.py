"""Plan-gating: status, stub upgrade/downgrade, the free load cap, isolation."""
import pytest

from app import config


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def test_status_defaults_to_free(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    s = client.get("/api/billing").json()
    assert s["plan"] == "free"
    assert s["is_pro"] is False
    assert s["configured"] is False  # stub mode
    assert s["max_loads"] == config.FREE_MAX_LOADS
    assert {p["key"] for p in s["plans"]} == {"free", "pro"}


def test_stub_checkout_upgrades_then_downgrade(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    res = client.post("/api/billing/checkout")
    assert res.status_code == 200
    assert "/settings?billing=success" in res.json()["url"]
    assert client.get("/api/billing").json()["is_pro"] is True

    # Downgrade (stub) flips back to free.
    back = client.post("/api/billing/downgrade")
    assert back.status_code == 200 and back.json()["plan"] == "free"


def test_free_load_cap_blocks_then_pro_unlocks(client, seeded, db, monkeypatch):
    monkeypatch.setattr(config, "FREE_MAX_LOADS", 2)
    _login(client, "a@example.com", "password-a")
    sh = _shipper(db, seeded["org_a"])

    assert client.post("/api/loads", json={"shipper_id": sh.id}).status_code == 201
    assert client.post("/api/loads", json={"shipper_id": sh.id}).status_code == 201
    # Third load on the free plan is blocked.
    blocked = client.post("/api/loads", json={"shipper_id": sh.id})
    assert blocked.status_code == 402
    assert "Upgrade" in blocked.json()["detail"]

    # Upgrade to Pro → unlimited.
    client.post("/api/billing/checkout")
    assert client.post("/api/loads", json={"shipper_id": sh.id}).status_code == 201


def test_checkout_requires_owner(client, seeded, db):
    from app.models import User
    from app.security import hash_password

    member = User(
        organization_id=seeded["org_a"], email="m@example.com",
        password_hash=hash_password("password-m"), full_name="Member", role="member",
    )
    db.add(member)
    db.commit()
    _login(client, "m@example.com", "password-m")
    assert client.post("/api/billing/checkout").status_code == 403


def test_webhook_verifies_signature_and_applies(seeded, db, monkeypatch):
    import hashlib
    import hmac
    import json
    import time

    from app import billing
    from app.models import Organization

    monkeypatch.setattr(config, "STRIPE_WEBHOOK_SECRET", "whsec_test")
    org_id = seeded["org_a"]
    event = {
        "type": "checkout.session.completed",
        "data": {"object": {"client_reference_id": str(org_id),
                             "customer": "cus_1", "subscription": "sub_1"}},
    }
    payload = json.dumps(event).encode()
    ts = str(int(time.time()))
    sig = hmac.new(b"whsec_test", f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()

    parsed = billing.verify_webhook(payload, f"t={ts},v1={sig}")
    billing.apply_event(db, parsed)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    assert org.plan == "pro" and org.stripe_subscription_id == "sub_1"

    # A tampered signature is rejected.
    with pytest.raises(ValueError):
        billing.verify_webhook(payload, f"t={ts},v1=deadbeef")


def test_billing_is_tenant_scoped(client, seeded, db):
    # Upgrading org A must not affect org B's plan.
    _login(client, "a@example.com", "password-a")
    client.post("/api/billing/checkout")
    assert client.get("/api/billing").json()["is_pro"] is True

    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.get("/api/billing").json()["is_pro"] is False
