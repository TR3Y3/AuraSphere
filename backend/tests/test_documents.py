"""Load document attachments: upload, list, download, delete, isolation."""
import io


def _login(client, email, password):
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 200


def _shipper(db, org_id):
    from app.models import Company

    return db.query(Company).filter(Company.organization_id == org_id).first()


def _load(client, db, org_id):
    sh = _shipper(db, org_id)
    return client.post("/api/loads", json={"shipper_id": sh.id}).json()["id"]


def _upload(client, load_id, content=b"%PDF-1.4 fake", name="ratecon.pdf", kind="rate_con"):
    return client.post(
        f"/api/loads/{load_id}/documents",
        files={"file": (name, io.BytesIO(content), "application/pdf")},
        data={"kind": kind},
    )


def test_upload_list_download_delete(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])

    res = _upload(client, lid, content=b"BOL bytes here", name="bol.pdf", kind="bol")
    assert res.status_code == 201, res.text
    doc = res.json()
    assert doc["filename"] == "bol.pdf"
    assert doc["kind"] == "bol"
    assert doc["size"] == len(b"BOL bytes here")
    # bytes are not exposed in the JSON
    assert "data" not in doc

    lst = client.get(f"/api/loads/{lid}/documents").json()
    assert len(lst) == 1 and lst[0]["id"] == doc["id"]

    dl = client.get(f"/api/loads/{lid}/documents/{doc['id']}/download")
    assert dl.status_code == 200
    assert dl.content == b"BOL bytes here"
    assert "attachment" in dl.headers["content-disposition"]

    assert client.delete(f"/api/loads/{lid}/documents/{doc['id']}").status_code == 204
    assert client.get(f"/api/loads/{lid}/documents").json() == []


def test_empty_file_and_bad_kind_rejected(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])

    assert _upload(client, lid, content=b"").status_code == 422
    assert _upload(client, lid, kind="invalid").status_code == 422


def test_documents_are_tenant_isolated(client, seeded, db):
    _login(client, "a@example.com", "password-a")
    lid = _load(client, db, seeded["org_a"])
    doc_id = _upload(client, lid).json()["id"]

    # Org B cannot see, download, or delete org A's load documents.
    client.post("/api/auth/logout")
    _login(client, "b@example.com", "password-b")
    assert client.get(f"/api/loads/{lid}/documents").status_code == 404
    assert client.get(f"/api/loads/{lid}/documents/{doc_id}/download").status_code == 404
    assert client.delete(f"/api/loads/{lid}/documents/{doc_id}").status_code == 404
    assert _upload(client, lid).status_code == 404
