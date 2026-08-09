"""EmotionSense API — FastAPI application entrypoint."""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import API_VERSION, get_settings
from .limiter import limiter, rate_limit_headers
from .model import init_classifier
from .routers import health, predict

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("emotionsense")

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("EmotionSense API %s starting — model=%s", API_VERSION, settings.model_repo)
    # Non-blocking: /api/health answers immediately with status="loading" while
    # the weights download, which is what drives the frontend's cold-start UI.
    init_classifier(settings, background=True)
    yield
    log.info("shutting down")


DESCRIPTION = """
Real-time emotion classification for short English text.

A DistilBERT model fine-tuned on [`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion)
scores every input across six emotions — **sadness, joy, love, anger, fear, surprise** —
and returns the full probability distribution, not just the winner.

* `POST /api/predict` — one text
* `POST /api/predict/batch` — up to 200 texts plus their aggregate distribution
* `GET /api/health` — liveness and model readiness
* `GET /api/model` — the real evaluation metrics behind the numbers shown in the app

The dataset is licensed for research and educational use. This API is not a clinical
or diagnostic instrument.
"""

app = FastAPI(
    title="EmotionSense API",
    description=DESCRIPTION,
    version=API_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_tags=[
        {"name": "prediction", "description": "Score text against the six emotion classes."},
        {"name": "meta", "description": "Service health and model provenance."},
    ],
    contact={"name": "EmotionSense", "url": "https://github.com/"},
    license_info={"name": "MIT"},
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # per-PR preview deployments
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def response_metadata(request: Request, call_next):
    """Attach timing and rate-limit metadata to every response."""
    t0 = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = f"{(time.perf_counter() - t0) * 1000:.1f}"
    for key, value in rate_limit_headers(request).items():
        response.headers[key] = value
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Turn Pydantic's nested error blob into one human-readable sentence.

    The frontend renders `detail` directly, so it has to read like product copy.
    """
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", ())[1:]) or "request"
    message = first.get("msg", "Invalid request").removeprefix("Value error, ")
    return JSONResponse(
        status_code=422,
        content={"detail": f"{field}: {message}", "code": "validation_error"},
    )


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("/docs" if settings.enable_docs else "/api/health")


app.include_router(health.router)
app.include_router(predict.router)


if __name__ == "__main__":  # pragma: no cover - local convenience only
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
