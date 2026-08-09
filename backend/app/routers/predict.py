"""Prediction endpoints.

Note: this module deliberately does *not* use `from __future__ import annotations`.
The `@limiter.limit` decorator wraps each handler, and FastAPI resolves string
annotations against the wrapper's module globals — where `PredictRequest` doesn't
exist. The body parameter would silently degrade to a query parameter. Real
annotation objects sidestep the whole problem.
"""

import logging
import time
from collections import defaultdict

from fastapi import APIRouter, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from ..config import get_settings
from ..limiter import RATE_LIMIT, limiter
from ..model import EMOJI, ModelNotReady, get_classifier
from ..schemas import (
    AggregateBucket,
    BatchPredictRequest,
    BatchPredictResponse,
    ErrorResponse,
    PredictRequest,
    PredictResponse,
)

log = logging.getLogger("emotionsense.api")
router = APIRouter(prefix="/api", tags=["prediction"])
settings = get_settings()

def loading_response() -> JSONResponse:
    """Built per call — a Response instance must not be shared across requests."""
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": (
                "The model is still waking up. On the free hosting tier this can take up to "
                "a minute after a period of inactivity — retry shortly."
            ),
            "code": "model_loading",
        },
        headers={"Retry-After": "10"},
    )


def _to_response(text: str, scores: list[dict], latency_ms: float, source: str) -> PredictResponse:
    top = scores[0]
    return PredictResponse(
        text=text,
        label=top["label"],
        emoji=EMOJI[top["label"]],
        confidence=round(top["score"], 6),
        predictions=[{"label": s["label"], "score": round(s["score"], 6)} for s in scores],
        latency_ms=round(latency_ms, 2),
        model_source=source,
    )


@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Classify one piece of text",
    responses={
        422: {"model": ErrorResponse, "description": "Empty or oversized text"},
        503: {"model": ErrorResponse, "description": "Model still loading"},
    },
)
@router.post("/predict/", include_in_schema=False)
@limiter.limit(RATE_LIMIT)
async def predict(request: Request, response: Response, body: PredictRequest):
    # `response` is required by slowapi to attach X-RateLimit-* headers.
    clf = get_classifier()
    t0 = time.perf_counter()
    try:
        scores = await run_in_threadpool(clf.predict, body.text)
    except ModelNotReady:
        return loading_response()

    latency_ms = (time.perf_counter() - t0) * 1000
    result = _to_response(body.text, scores, latency_ms, clf.source)
    # Log shape, not content: never persist the user's text.
    log.info(
        "predict chars=%d label=%s conf=%.3f latency=%.1fms source=%s",
        len(body.text),
        result.label,
        result.confidence,
        latency_ms,
        clf.source,
    )
    return result


@router.post(
    "/predict/batch",
    response_model=BatchPredictResponse,
    summary="Classify many texts and get the aggregate distribution",
    responses={
        422: {"model": ErrorResponse, "description": "Empty list or an item over the size limit"},
        503: {"model": ErrorResponse, "description": "Model still loading"},
    },
)
@router.post("/predict/batch/", include_in_schema=False)
@limiter.limit(RATE_LIMIT)
async def predict_batch(request: Request, response: Response, body: BatchPredictRequest):
    clf = get_classifier()
    t0 = time.perf_counter()
    try:
        all_scores = await run_in_threadpool(clf.predict_many, body.texts)
    except ModelNotReady:
        return loading_response()

    latency_ms = (time.perf_counter() - t0) * 1000
    per_item = latency_ms / max(len(body.texts), 1)
    results = [
        _to_response(text, scores, per_item, clf.source)
        for text, scores in zip(body.texts, all_scores)
    ]

    counts: dict[str, int] = defaultdict(int)
    conf_sum: dict[str, float] = defaultdict(float)
    for r in results:
        counts[r.label] += 1
        conf_sum[r.label] += r.confidence

    total = len(results)
    aggregate = sorted(
        (
            AggregateBucket(
                label=label,
                count=count,
                share=round(count / total, 6),
                mean_confidence=round(conf_sum[label] / count, 6),
            )
            for label, count in counts.items()
        ),
        key=lambda b: (-b.count, b.label),
    )

    log.info(
        "batch n=%d dominant=%s latency=%.1fms source=%s",
        total,
        aggregate[0].label,
        latency_ms,
        clf.source,
    )
    return BatchPredictResponse(
        results=results,
        aggregate=aggregate,
        dominant=aggregate[0].label,
        count=total,
        latency_ms=round(latency_ms, 2),
        model_source=clf.source,
    )
