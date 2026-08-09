"""Pydantic request/response contracts. These generate the OpenAPI docs at /docs."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .config import get_settings

_settings = get_settings()

EmotionLabel = Literal["sadness", "joy", "love", "anger", "fear", "surprise"]


class PredictRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=_settings.min_text_length,
        max_length=_settings.max_text_length,
        description="Text to classify. Short, informal English works best.",
        examples=["i cant stop smiling after that message"],
    )

    @field_validator("text")
    @classmethod
    def not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("text must contain at least one non-whitespace character")
        return stripped


class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=_settings.max_batch_size,
        description=f"Up to {_settings.max_batch_size} texts to classify in one call.",
        examples=[["i feel great today", "i am so angry right now"]],
    )

    @field_validator("texts")
    @classmethod
    def clean(cls, v: list[str]) -> list[str]:
        cleaned = [t.strip() for t in v if t and t.strip()]
        if not cleaned:
            raise ValueError("texts must contain at least one non-empty string")
        too_long = next((t for t in cleaned if len(t) > _settings.max_text_length), None)
        if too_long is not None:
            raise ValueError(
                f"each text must be at most {_settings.max_text_length} characters "
                f"(got {len(too_long)})"
            )
        return cleaned


class EmotionScore(BaseModel):
    label: EmotionLabel
    score: float = Field(..., ge=0.0, le=1.0)


class PredictResponse(BaseModel):
    text: str = Field(..., description="The text that was scored, after trimming.")
    label: EmotionLabel = Field(..., description="Highest-scoring emotion.")
    emoji: str
    confidence: float = Field(..., ge=0.0, le=1.0, description="Score of the top label.")
    predictions: list[EmotionScore] = Field(..., description="All 6 scores, descending.")
    latency_ms: float
    model_source: str = Field(..., description="'transformer' or 'baseline'.")


class AggregateBucket(BaseModel):
    label: EmotionLabel
    count: int
    share: float = Field(..., ge=0.0, le=1.0)
    mean_confidence: float = Field(..., ge=0.0, le=1.0)


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]
    aggregate: list[AggregateBucket] = Field(
        ..., description="Distribution of top labels across the batch, descending by count."
    )
    dominant: EmotionLabel
    count: int
    latency_ms: float
    model_source: str


class HealthResponse(BaseModel):
    status: Literal["ok", "loading", "degraded"]
    model: str
    model_source: str
    version: str
    labels: list[str]
    uptime_seconds: float
    warm: bool = Field(..., description="False until the first inference has run.")


class ModelInfoResponse(BaseModel):
    """Real training metrics, so the frontend never hardcodes fabricated numbers."""

    model: str
    model_source: str
    labels: list[str]
    metrics: dict | None = Field(
        None, description="Contents of ml/artifacts/metrics.json when available."
    )


class ErrorResponse(BaseModel):
    detail: str
    code: str = "error"
