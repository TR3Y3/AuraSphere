"""Default pipeline/stage provisioning for an organization (Phase 3)."""
from sqlalchemy.orm import Session as DbSession

from app.models import Pipeline, Stage

DEFAULT_PIPELINE_NAME = "Sales Pipeline"
# (name, is_won, is_lost) in display order.
DEFAULT_STAGES = [
    ("New", False, False),
    ("Qualified", False, False),
    ("Proposal", False, False),
    ("Negotiation", False, False),
    ("Closed Won", True, False),
    ("Closed Lost", False, True),
]


def ensure_default_pipeline(db: DbSession, org_id: int) -> Pipeline:
    """Idempotently ensure the org has a default pipeline with stages."""
    pipeline = (
        db.query(Pipeline)
        .filter(Pipeline.organization_id == org_id, Pipeline.is_default.is_(True))
        .first()
    )
    if pipeline:
        return pipeline

    pipeline = Pipeline(organization_id=org_id, name=DEFAULT_PIPELINE_NAME, is_default=True)
    db.add(pipeline)
    db.flush()  # assign pipeline.id

    for sort_order, (name, is_won, is_lost) in enumerate(DEFAULT_STAGES):
        db.add(
            Stage(
                organization_id=org_id,
                pipeline_id=pipeline.id,
                name=name,
                sort_order=sort_order,
                is_won=is_won,
                is_lost=is_lost,
            )
        )
    db.commit()
    db.refresh(pipeline)
    return pipeline
