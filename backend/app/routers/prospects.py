"""Shipper Lead-Gen — prospect pipeline (S2, org-scoped).

Prospects are candidate shippers (+ a logistics contact) awaiting review.
Approving one converts it into a Shipper (company) and an optional Contact.
The `add-prospects` skill feeds rows in via POST; reps review/convert here.
"""
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_

from app import enrichment
from app.deps import OrgScope, get_scope
from app.freight_fit import score_freight_fit
from app.models import Company, Contact, Prospect
from app.schemas.common import Page
from app.schemas.prospect import (
    DuplicateRef,
    ProspectCreate,
    ProspectOut,
    ProspectUpdate,
)

router = APIRouter(prefix="/api/prospects", tags=["prospects"])

VALID_STATUS = ("new", "approved", "dismissed", "imported")


def _find_duplicate(scope: OrgScope, prospect: Prospect) -> Company | None:
    """An existing shipper that this prospect probably duplicates."""
    q = scope.query(Company).filter(
        func.lower(Company.name) == prospect.company_name.lower()
    )
    if prospect.domain:
        q = scope.query(Company).filter(
            or_(
                func.lower(Company.name) == prospect.company_name.lower(),
                func.lower(Company.domain) == prospect.domain.lower(),
            )
        )
    return q.first()


def _serialize(scope: OrgScope, p: Prospect) -> ProspectOut:
    out = ProspectOut.model_validate(p)
    if p.status != "imported":
        dup = _find_duplicate(scope, p)
        if dup:
            out.duplicate_of = DuplicateRef(id=dup.id, name=dup.name)
    return out


def _get_owned(scope: OrgScope, prospect_id: int) -> Prospect:
    p = scope.query(Prospect).filter(Prospect.id == prospect_id).first()
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return p


@router.get("", response_model=Page[ProspectOut])
def list_prospects(
    scope: OrgScope = Depends(get_scope),
    search: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    sort: str = "freight_fit_score",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    q = scope.query(Prospect)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Prospect.company_name.ilike(like),
            Prospect.industry.ilike(like),
            Prospect.city.ilike(like),
            Prospect.state.ilike(like),
            Prospect.domain.ilike(like),
            Prospect.contact_name.ilike(like),
        ))
    if status_filter:
        q = q.filter(Prospect.status == status_filter)

    total = q.count()
    sort_col = {
        "freight_fit_score": Prospect.freight_fit_score,
        "created_at": Prospect.created_at,
        "company_name": Prospect.company_name,
    }.get(sort, Prospect.freight_fit_score)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc().nullslast())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return Page(items=[_serialize(scope, p) for p in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=ProspectOut, status_code=status.HTTP_201_CREATED)
def create_prospect(payload: ProspectCreate, scope: OrgScope = Depends(get_scope)):
    score = payload.freight_fit_score
    reason = payload.fit_reason
    if score is None:
        score, reason = score_freight_fit(payload.industry, payload.company_name)
    p = Prospect(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        freight_fit_score=score,
        fit_reason=reason,
        status="new",
        **payload.model_dump(exclude={"freight_fit_score", "fit_reason"}),
    )
    scope.db.add(p)
    scope.db.commit()
    scope.db.refresh(p)
    return _serialize(scope, p)


# Flexible header aliases so reps can upload whatever CSV they already have.
_CSV_ALIASES = {
    "company_name": {"company_name", "company", "name", "account", "account_name", "business"},
    "domain": {"domain", "website", "url", "web"},
    "industry": {"industry", "sector", "vertical"},
    "city": {"city", "town"},
    "state": {"state", "st", "province"},
    "contact_name": {"contact_name", "contact", "poc", "poc_name", "full_name"},
    "contact_title": {"contact_title", "title", "role", "position"},
    "contact_email": {"contact_email", "email", "e-mail", "email_address"},
    "contact_phone": {"contact_phone", "phone", "phone_number", "tel", "telephone", "mobile"},
}


def _map_row(row: dict) -> dict:
    # Guard against ragged rows: csv.DictReader puts extra columns in a list
    # under a None key, and short rows yield None values.
    norm = {
        (k or "").strip().lower().replace(" ", "_"): (v.strip() if isinstance(v, str) else "")
        for k, v in row.items() if k is not None
    }
    out: dict = {}
    for field, aliases in _CSV_ALIASES.items():
        for a in aliases:
            if norm.get(a):
                out[field] = norm[a]
                break
    return out


@router.post("/import")
async def import_prospects(file: UploadFile = File(...), scope: OrgScope = Depends(get_scope)):
    """Bulk-import candidate shippers from a CSV. Flexible headers; rows without
    a company name are skipped. Each imported row is freight-fit scored."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    skipped = 0
    for row in reader:
        data = _map_row(row)
        if not data.get("company_name"):
            skipped += 1
            continue
        score, reason = score_freight_fit(data.get("industry"), data.get("company_name"))
        scope.db.add(Prospect(
            organization_id=scope.org_id, created_by=scope.user.id,
            freight_fit_score=score, fit_reason=reason, status="new",
            source="csv_import", **data,
        ))
        created += 1
    scope.db.commit()
    return {"created": created, "skipped": skipped}


@router.patch("/{prospect_id}", response_model=ProspectOut)
def update_prospect(prospect_id: int, payload: ProspectUpdate, scope: OrgScope = Depends(get_scope)):
    p = _get_owned(scope, prospect_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in VALID_STATUS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"status must be one of {', '.join(VALID_STATUS)}")
    for field, value in data.items():
        setattr(p, field, value)
    # Re-score if the industry changed and no manual score override.
    if "industry" in data:
        p.freight_fit_score, p.fit_reason = score_freight_fit(p.industry, p.company_name)
    scope.db.commit()
    scope.db.refresh(p)
    return _serialize(scope, p)


@router.post("/{prospect_id}/enrich", response_model=ProspectOut)
def enrich_prospect(prospect_id: int, scope: OrgScope = Depends(get_scope)):
    """Find the prospect's logistics contact (Hunter.io seam; stub by default).

    Fills only EMPTY contact fields — never clobbers data a rep already typed.
    """
    p = _get_owned(scope, prospect_id)
    if not p.domain:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Add a domain to this prospect first — enrichment searches by domain.")
    found = enrichment.enrich_domain(p.domain)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No contacts found for that domain.")
    for field in ("contact_name", "contact_title", "contact_email", "contact_phone"):
        if not getattr(p, field) and found.get(field):
            setattr(p, field, found[field])
    src = found.get("source", "stub")
    note = f"Contact enriched via {'Hunter.io' if src == 'hunter' else 'demo data'}"
    p.notes = f"{p.notes}\n{note}" if p.notes else note
    scope.db.commit()
    scope.db.refresh(p)
    return _serialize(scope, p)


@router.delete("/{prospect_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prospect(prospect_id: int, scope: OrgScope = Depends(get_scope)):
    p = _get_owned(scope, prospect_id)
    scope.db.delete(p)
    scope.db.commit()


@router.post("/{prospect_id}/convert", response_model=ProspectOut)
def convert_prospect(prospect_id: int, scope: OrgScope = Depends(get_scope)):
    """Create a Shipper (+ optional Contact) from the prospect; mark imported."""
    p = _get_owned(scope, prospect_id)
    if p.status == "imported":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already imported")

    shipper = Company(
        organization_id=scope.org_id,
        created_by=scope.user.id,
        owner_id=scope.user.id,
        name=p.company_name,
        domain=p.domain,
        industry=p.industry,
        website=p.website,
    )
    scope.db.add(shipper)
    scope.db.flush()
    p.shipper_id = shipper.id

    if p.contact_name:
        first, _, last = p.contact_name.partition(" ")
        contact = Contact(
            organization_id=scope.org_id,
            created_by=scope.user.id,
            owner_id=scope.user.id,
            first_name=first or p.contact_name,
            last_name=last or None,
            title=p.contact_title,
            email=p.contact_email,
            phone=p.contact_phone,
            company_id=shipper.id,
        )
        scope.db.add(contact)
        scope.db.flush()
        p.contact_id = contact.id

    p.status = "imported"
    scope.db.commit()
    scope.db.refresh(p)
    return _serialize(scope, p)
