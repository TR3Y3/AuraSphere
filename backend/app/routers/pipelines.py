"""Pipelines + stages (Phase 3). Read-only; one default per org is seeded."""
from fastapi import APIRouter, Depends

from app.defaults import ensure_default_pipeline
from app.deps import OrgScope, get_scope
from app.models import Pipeline, Stage
from app.schemas.pipeline import PipelineOut, StageOut

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


def _serialize(scope: OrgScope, pipeline: Pipeline) -> PipelineOut:
    stages = (
        scope.query(Stage)
        .filter(Stage.pipeline_id == pipeline.id)
        .order_by(Stage.sort_order)
        .all()
    )
    return PipelineOut(
        id=pipeline.id,
        name=pipeline.name,
        is_default=pipeline.is_default,
        stages=[StageOut.model_validate(s) for s in stages],
    )


@router.get("", response_model=list[PipelineOut])
def list_pipelines(scope: OrgScope = Depends(get_scope)):
    # Lazily guarantee the org has a default pipeline so the board always works.
    ensure_default_pipeline(scope.db, scope.org_id)
    pipelines = scope.query(Pipeline).order_by(Pipeline.id).all()
    return [_serialize(scope, p) for p in pipelines]
