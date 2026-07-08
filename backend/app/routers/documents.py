"""Load document attachments (rate con / BOL / POD / other), org-scoped.

Files are stored as bytes in the DB (LargeBinary) so they persist on
managed Postgres without an external object store.
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status as http
from fastapi.responses import Response

from app import events
from app.deps import OrgScope, get_scope
from app.models import Document, Load
from app.schemas.document import DocumentOut

router = APIRouter(prefix="/api/loads/{load_id}/documents", tags=["documents"])

ALLOWED_KINDS = {"rate_con", "bol", "pod", "other"}
MAX_BYTES = 15 * 1024 * 1024  # 15 MB


def _require_load(scope: OrgScope, load_id: int) -> Load:
    load = scope.query(Load).filter(Load.id == load_id).first()
    if load is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Load not found")
    return load


def _require_doc(scope: OrgScope, load_id: int, doc_id: int) -> Document:
    doc = (
        scope.query(Document)
        .filter(Document.id == doc_id, Document.load_id == load_id)
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(load_id: int, scope: OrgScope = Depends(get_scope)):
    _require_load(scope, load_id)
    return (
        scope.query(Document)
        .filter(Document.load_id == load_id)
        .order_by(Document.id.desc())
        .all()
    )


@router.post("", response_model=DocumentOut, status_code=http.HTTP_201_CREATED)
async def upload_document(
    load_id: int,
    file: UploadFile = File(...),
    kind: str | None = Form(None),
    scope: OrgScope = Depends(get_scope),
):
    _require_load(scope, load_id)
    if kind is not None and kind not in ALLOWED_KINDS:
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"kind must be one of {', '.join(sorted(ALLOWED_KINDS))}")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=http.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="File exceeds 15 MB limit")
    doc = Document(
        organization_id=scope.org_id,
        load_id=load_id,
        filename=file.filename or "upload",
        content_type=file.content_type,
        size=len(data),
        kind=kind,
        data=data,
        uploaded_by=scope.user.id,
    )
    scope.db.add(doc)
    scope.db.flush()
    events.log_event(
        scope.db, org_id=scope.org_id, load_id=load_id, event_type="doc_uploaded",
        subject=f"Document uploaded: {doc.filename}" + (f" ({kind})" if kind else ""),
        meta={"document_id": doc.id, "kind": kind}, actor_id=scope.user.id,
    )
    scope.db.commit()
    scope.db.refresh(doc)
    return doc


@router.get("/{doc_id}/download")
def download_document(load_id: int, doc_id: int, scope: OrgScope = Depends(get_scope)):
    _require_load(scope, load_id)
    doc = _require_doc(scope, load_id, doc_id)
    return Response(
        content=doc.data,
        media_type=doc.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )


@router.delete("/{doc_id}", status_code=http.HTTP_204_NO_CONTENT)
def delete_document(load_id: int, doc_id: int, scope: OrgScope = Depends(get_scope)):
    _require_load(scope, load_id)
    doc = _require_doc(scope, load_id, doc_id)
    scope.db.delete(doc)
    scope.db.commit()
