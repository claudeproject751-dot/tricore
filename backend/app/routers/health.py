"""Health and model-metadata endpoints.

`/api/health` is what the Render health check hits and what the frontend polls for
its "API status" indicator, so it must stay cheap and must never depend on the model
being loaded.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter

from ..config import API_VERSION, get_settings
from ..model import LABELS, get_classifier
from ..schemas import HealthResponse, ModelInfoResponse

router = APIRouter(prefix="/api", tags=["meta"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse, summary="Liveness + model readiness")
async def health() -> HealthResponse:
    clf = get_classifier()
    return HealthResponse(
        status=clf.status(),
        model=clf.name,
        model_source=clf.source,
        version=API_VERSION,
        labels=list(LABELS),
        uptime_seconds=round(time.monotonic() - clf.started_at, 1),
        warm=clf.warm,
    )


@router.get(
    "/model",
    response_model=ModelInfoResponse,
    summary="Real training metrics for the About page",
)
async def model_info() -> ModelInfoResponse:
    clf = get_classifier()
    metrics = None
    if settings.metrics_path.exists():
        try:
            metrics = json.loads(settings.metrics_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            metrics = None
    return ModelInfoResponse(
        model=clf.name,
        model_source=clf.source,
        labels=list(LABELS),
        metrics=metrics,
    )
