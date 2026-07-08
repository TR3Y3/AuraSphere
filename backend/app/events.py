"""Load feed system events (Prompt 5).

One helper writes auto-posted entries into the existing `activities` table
(kind='system'), so user notes and system events share a single chronological
feed per load. System rows are read-only through the API.

Noise policy — feed-worthy events only. Field edits, DAT posts, and raw GPS
pings stay out of the feed (tracking owns pings; the DB is the audit trail
for edits).
"""
from app.models import Activity

# Human-readable one-liners live here so every emitter formats the same way.
STATUS_LABEL = {
    "quote": "Quote", "tendered": "Tendered", "offered": "Offered",
    "covered": "Covered", "dispatched": "Dispatched", "in_transit": "In transit",
    "delivered": "Delivered", "invoiced": "Invoiced", "lost": "Lost", "tonu": "TONU",
}


def log_event(
    db,
    *,
    org_id: int,
    load_id: int,
    event_type: str,
    subject: str,
    body: str | None = None,
    meta: dict | None = None,
    actor_id: int | None = None,
) -> Activity:
    """Append a system entry to a load's feed. Caller commits."""
    row = Activity(
        organization_id=org_id,
        type="system",
        kind="system",
        event_type=event_type,
        subject=subject,
        body=body,
        meta=meta,
        related_load_id=load_id,
        owner_id=actor_id,
    )
    db.add(row)
    return row


def log_status_change(db, load, old_status: str, new_status: str, actor_id: int | None) -> None:
    if old_status == new_status:
        return
    log_event(
        db, org_id=load.organization_id, load_id=load.id, event_type="status_change",
        subject=f"Status: {STATUS_LABEL.get(old_status, old_status)} → {STATUS_LABEL.get(new_status, new_status)}",
        meta={"from": old_status, "to": new_status}, actor_id=actor_id,
    )


def log_carrier_change(db, load, old_name: str | None, new_name: str | None, actor_id: int | None) -> None:
    if new_name and not old_name:
        subject, etype = f"Carrier assigned: {new_name}", "carrier_assigned"
    elif old_name and not new_name:
        subject, etype = f"Carrier removed: {old_name}", "carrier_removed"
    elif old_name and new_name and old_name != new_name:
        subject, etype = f"Carrier changed: {old_name} → {new_name}", "carrier_assigned"
    else:
        return
    log_event(db, org_id=load.organization_id, load_id=load.id, event_type=etype,
              subject=subject, meta={"from": old_name, "to": new_name}, actor_id=actor_id)
