"""Application settings, loaded from environment / .env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent

API_VERSION = "1.0.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    model_repo: str = Field(
        default="bhadresh-savani/distilbert-base-uncased-emotion",
        description=(
            "Hugging Face repo id or local directory of the fine-tuned classifier. "
            "The default is a public model trained on the same dataset and label set, "
            "so the API is functional before you publish your own."
        ),
    )
    hf_token: str | None = None

    allowed_origin: str = "http://localhost:3000,http://127.0.0.1:3000"
    rate_limit: str = "60/minute"

    max_text_length: int = 1000
    min_text_length: int = 1
    max_batch_size: int = 200

    enable_docs: bool = True
    log_level: str = "INFO"

    # Path to the TF-IDF fallback used when the transformer cannot be loaded
    # (no network on a cold container, bad repo id, etc.). Optional.
    baseline_path: Path = REPO_ROOT / "ml" / "artifacts" / "baseline.joblib"
    # Path to the training metrics the /api/model endpoint surfaces to the UI.
    metrics_path: Path = REPO_ROOT / "ml" / "artifacts" / "metrics.json"

    @field_validator("allowed_origin")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
