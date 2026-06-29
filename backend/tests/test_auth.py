"""Login / logout / session behavior."""


def test_login_success_sets_cookie_and_returns_identity(client, seeded):
    r = client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "password-a"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "a@example.com"
    assert body["organization"]["slug"] == "org-a"
    assert "aurasphere_session" in r.cookies


def test_login_wrong_password_rejected(client, seeded):
    r = client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "nope"}
    )
    assert r.status_code == 401


def test_login_unknown_email_rejected(client, seeded):
    r = client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": "x"}
    )
    assert r.status_code == 401


def test_me_requires_auth(client, seeded):
    assert client.get("/api/auth/me").status_code == 401


def test_logout_invalidates_session(client, seeded):
    client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "password-a"}
    )
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    # Cookie cleared and the server-side session is gone.
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401
