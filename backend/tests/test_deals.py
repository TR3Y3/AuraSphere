"""Deals CRUD, the kanban stage-change endpoint, and tenant isolation."""


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _default_pipeline(client):
    pipelines = client.get("/api/pipelines").json()
    assert len(pipelines) >= 1
    return next(p for p in pipelines if p["is_default"])


def test_pipeline_seeded_with_stages(client, seeded):
    _login(client, "a@example.com", "password-a")
    p = _default_pipeline(client)
    names = [s["name"] for s in p["stages"]]
    assert names[0] == "New"
    assert any(s["is_won"] for s in p["stages"])
    assert any(s["is_lost"] for s in p["stages"])


def test_create_deal_defaults_to_first_stage(client, seeded):
    _login(client, "a@example.com", "password-a")
    p = _default_pipeline(client)
    res = client.post("/api/deals", json={"name": "Big deal", "amount": "5000.00"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["stage_id"] == p["stages"][0]["id"]
    assert body["pipeline_id"] == p["id"]
    assert body["owner_id"] is not None


def test_stage_change_persists_and_sets_closed_at(client, seeded):
    _login(client, "a@example.com", "password-a")
    p = _default_pipeline(client)
    won = next(s for s in p["stages"] if s["is_won"])
    deal_id = client.post("/api/deals", json={"name": "Movable"}).json()["id"]

    res = client.patch(f"/api/deals/{deal_id}/stage", json={"stage_id": won["id"]})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["stage_id"] == won["id"]
    assert body["closed_at"] is not None

    # Survives a re-fetch (drag persists).
    assert client.get(f"/api/deals/{deal_id}").json()["stage_id"] == won["id"]


def test_stage_change_rejects_foreign_stage(client, seeded, db):
    # A stage id from another org's pipeline must be refused (422), not applied.
    from app.defaults import ensure_default_pipeline
    from app.models import Stage

    pl_b = ensure_default_pipeline(db, seeded["org_b"])
    stage_b = db.query(Stage).filter(Stage.pipeline_id == pl_b.id).first()

    _login(client, "a@example.com", "password-a")
    deal_id = client.post("/api/deals", json={"name": "Guarded"}).json()["id"]
    res = client.patch(f"/api/deals/{deal_id}/stage", json={"stage_id": stage_b.id})
    assert res.status_code == 422


def test_deal_isolation(client, seeded):
    _login(client, "a@example.com", "password-a")
    deal_id = client.post("/api/deals", json={"name": "Org A only"}).json()["id"]

    client.cookies.clear()
    _login(client, "b@example.com", "password-b")
    # Invisible to org B — 404 on read and on stage change.
    assert client.get(f"/api/deals/{deal_id}").status_code == 404
    p_b = _default_pipeline(client)
    assert client.patch(
        f"/api/deals/{deal_id}/stage", json={"stage_id": p_b["stages"][0]["id"]}
    ).status_code == 404
    assert client.get("/api/deals").json()["total"] == 0
