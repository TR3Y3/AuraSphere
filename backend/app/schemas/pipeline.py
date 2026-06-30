"""Pipeline + stage schemas (Phase 3)."""
from pydantic import BaseModel, ConfigDict


class StageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pipeline_id: int
    name: str
    sort_order: int
    is_won: bool
    is_lost: bool


class PipelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_default: bool
    stages: list[StageOut]
