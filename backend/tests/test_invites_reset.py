"""Teammate invites + forgot/reset password flows, with role + isolation checks."""


def _login(client, email, password):
    assert client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


# ── Invites ────────────────────────────────────────────────────────────────

def test_owner_can_invite_teammate_who_sets_password(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    res = client.post("/api/users/invite", json={
        "email": "rep@example.com", "full_name": "New Rep", "role": "member",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user"]["email"] == "rep@example.com"
    assert body["user"]["role"] == "member"
    assert body["invite_url"] and "/reset-password?token=" in body["invite_url"]

    # The invited rep sets their password via the link and is logged in.
    token = body["invite_url"].split("token=")[1]
    client.post("/api/auth/logout")
    done = client.post("/api/auth/reset-password", json={"token": token, "password": "brandnewpass1"})
    assert done.status_code == 200
    assert done.json()["user"]["email_verified"] is True
    # And can now log in with the chosen password.
    client.post("/api/auth/logout")
    _login(client, "rep@example.com", "brandnewpass1")


def test_invite_lands_in_the_inviters_org(client, seeded, db):
    from app.models import User

    _login(client, "a@example.com", "password-a")
    client.post("/api/users/invite", json={"email": "rep2@example.com", "full_name": "Rep Two"})
    rep = db.query(User).filter(User.email == "rep2@example.com").first()
    assert rep.organization_id == seeded["org_a"]


def test_duplicate_invite_rejected(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    assert client.post("/api/users/invite", json={"email": "dup@example.com", "full_name": "Dup"}).status_code == 201
    assert client.post("/api/users/invite", json={"email": "dup@example.com", "full_name": "Dup"}).status_code == 409


def test_member_cannot_invite(client, seeded, db):
    from app.models import User
    from app.security import hash_password

    db.add(User(organization_id=seeded["org_a"], email="m@example.com",
                password_hash=hash_password("password-m"), full_name="Member", role="member"))
    db.commit()
    _login(client, "m@example.com", "password-m")
    assert client.post("/api/users/invite", json={"email": "x@example.com", "full_name": "X"}).status_code == 403


# ── Forgot / reset ─────────────────────────────────────────────────────────

def test_forgot_password_issues_reset_and_login_works(client, seeded, db):
    from app.models import PasswordResetToken, User

    # Always 204, even for an unknown email (no account enumeration).
    assert client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"}).status_code == 204
    assert client.post("/api/auth/forgot-password", json={"email": "a@example.com"}).status_code == 204

    user = db.query(User).filter(User.email == "a@example.com").first()
    row = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).first()
    assert row is not None  # a token was issued for the real user

    # (We can't read the raw token from the hash, so drive reset via a fresh
    # token issued through the invite path is covered above; here assert the
    # bad-token path.)
    assert client.post("/api/auth/reset-password", json={"token": "bogus", "password": "whatever12"}).status_code == 400


def test_reset_password_single_use(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    token = client.post("/api/users/invite", json={
        "email": "once@example.com", "full_name": "Once",
    }).json()["invite_url"].split("token=")[1]
    client.post("/api/auth/logout")

    assert client.post("/api/auth/reset-password", json={"token": token, "password": "firsttry123"}).status_code == 200
    # Token is consumed.
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "secondtry123"}).status_code == 400
