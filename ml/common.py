"""Shared constants and helpers for the EmotionSense training pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ML_DIR = Path(__file__).resolve().parent
ARTIFACTS = ML_DIR / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

DATASET_ID = "dair-ai/emotion"
DATASET_CONFIG = "split"
BASE_MODEL = "distilbert-base-uncased"
MAX_LENGTH = 96

ID2LABEL: dict[int, str] = {
    0: "sadness",
    1: "joy",
    2: "love",
    3: "anger",
    4: "fear",
    5: "surprise",
}
LABEL2ID: dict[str, int] = {v: k for k, v in ID2LABEL.items()}
LABEL_NAMES: list[str] = [ID2LABEL[i] for i in range(len(ID2LABEL))]

# Kept in sync with frontend/lib/emotion-theme.ts — one accent per emotion.
EMOTION_COLORS: dict[str, str] = {
    "joy": "#F5B942",
    "sadness": "#4A7FE0",
    "love": "#E85D8C",
    "anger": "#E5484D",
    "fear": "#8B5CF6",
    "surprise": "#2DD4BF",
}


def write_json(path: Path, payload: Any) -> Path:
    """Write `payload` as pretty JSON and return the path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(ML_DIR.parent)}")
    return path


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def banner(text: str) -> None:
    line = "=" * max(56, len(text) + 4)
    print(f"\n{line}\n  {text}\n{line}")
