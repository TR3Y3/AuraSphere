"""Email delivery: provider routing, payload, and resilience."""
import httpx
import pytest

from app import config, email


@pytest.fixture(autouse=True)
def restore_email_config():
    saved = (config.EMAIL_DELIVERY, config.RESEND_API_KEY)
    yield
    config.EMAIL_DELIVERY, config.RESEND_API_KEY = saved


def test_console_mode_does_not_send(monkeypatch):
    config.EMAIL_DELIVERY = "console"
    called = False

    def boom(*a, **k):
        nonlocal called
        called = True

    monkeypatch.setattr(email.httpx, "post", boom)
    assert email.send_email("x@example.com", "Hi", "body") is True
    assert called is False  # console just logs


def test_resend_mode_posts_to_api(monkeypatch):
    config.EMAIL_DELIVERY = "resend"
    config.RESEND_API_KEY = "re_test"
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(email.httpx, "post", fake_post)
    ok = email.send_verification_email("dispatch@acme.com", "https://app/verify?token=abc")
    assert ok is True
    assert captured["url"] == email.RESEND_ENDPOINT
    assert captured["headers"]["Authorization"] == "Bearer re_test"
    assert captured["json"]["to"] == ["dispatch@acme.com"]
    assert "verify?token=abc" in captured["json"]["text"]


def test_send_failure_is_swallowed(monkeypatch):
    config.EMAIL_DELIVERY = "resend"
    config.RESEND_API_KEY = "re_test"

    def fake_post(*a, **k):
        return httpx.Response(500, request=httpx.Request("POST", email.RESEND_ENDPOINT))

    monkeypatch.setattr(email.httpx, "post", fake_post)
    # Never raises — returns False so callers (signup) stay robust.
    assert email.send_email("x@example.com", "Hi", "body") is False


def test_signup_survives_email_failure(client, db, monkeypatch):
    # Even if the provider is down, the account is created and the user is in.
    def boom(*a, **k):
        raise RuntimeError("provider down")

    monkeypatch.setattr(email.httpx, "post", boom)
    config.EMAIL_DELIVERY = "resend"
    config.RESEND_API_KEY = "re_test"

    res = client.post("/api/auth/signup", json={
        "organization_name": "Robust Co", "full_name": "R", "email": "r@example.com",
        "password": "supersecret1",
    })
    assert res.status_code == 201, res.text
    # Real-provider mode does not leak the verify link in the response.
    assert res.json()["verify_url"] is None
    assert client.get("/api/auth/me").status_code == 200
