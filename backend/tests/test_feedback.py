"""In-app feedback endpoint."""
from app import email as email_mod


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


def test_feedback_sends_email(client, seeded, db, monkeypatch):
    captured = {}

    def fake_send(to, subject, body):
        captured.update(to=to, subject=subject, body=body)
        return True

    monkeypatch.setattr(email_mod, "send_email", fake_send)
    # patch the reference imported into the router too
    from app.routers import feedback as fb
    monkeypatch.setattr(fb, "send_email", fake_send)

    _login(client, "a@example.com", "password-a")
    res = client.post("/api/feedback", json={"message": "The load board is great!", "page": "/loads"})
    assert res.status_code == 204
    assert "great" in captured["body"]
    assert "a@example.com" in captured["body"]
    assert "/loads" in captured["body"]


def test_feedback_requires_auth(client, seeded, db):
    assert client.post("/api/feedback", json={"message": "hi"}).status_code == 401


def test_feedback_rejects_empty(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    assert client.post("/api/feedback", json={"message": ""}).status_code == 422
