"""Test fixtures.

The API tests must not download 250MB of weights, so `client` swaps in a
deterministic stub classifier. `test_model.py` exercises the real loader
separately and is skipped unless explicitly enabled.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import model as model_module  # noqa: E402
from app.main import app  # noqa: E402
from app.model import LABELS, ModelNotReady  # noqa: E402


class StubClassifier:
    """Mimics EmotionClassifier without any ML dependency.

    Scores are derived from keyword hits so assertions can be meaningful, and
    always form a valid probability distribution.
    """

    KEYWORDS = {
        "sadness": ("sad", "empty", "alone", "lonely", "cry"),
        "joy": ("happy", "excited", "great", "smiling", "wonderful"),
        "love": ("love", "loved", "adore", "caring"),
        "anger": ("angry", "furious", "hate", "mad"),
        "fear": ("afraid", "scared", "terrified", "anxious"),
        "surprise": ("surprised", "shocked", "stunned", "unbelievable"),
    }

    def __init__(self, *, ready: bool = True, source: str = "transformer") -> None:
        self._ready = ready
        self.source = source if ready else "none"
        self.warm = False
        self.started_at = 0.0
        self.calls: list[list[str]] = []

    def load(self) -> None:
        """No-op: app startup calls this on whatever classifier is installed."""

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def name(self) -> str:
        return "stub/emotion-distilbert" if self._ready else "unloaded"

    def status(self) -> str:
        return "ok" if self._ready else "loading"

    def predict_many(self, texts: list[str]) -> list[list[dict]]:
        if not self._ready:
            raise ModelNotReady("still loading")
        self.calls.append(texts)
        out = []
        for text in texts:
            lowered = text.lower()
            weights = {
                label: 1.0 + 8.0 * sum(word in lowered for word in words)
                for label, words in self.KEYWORDS.items()
            }
            total = sum(weights.values())
            scores = sorted(
                ({"label": lab, "score": w / total} for lab, w in weights.items()),
                key=lambda d: -d["score"],
            )
            out.append(scores)
        self.warm = True
        return out

    def predict(self, text: str) -> list[dict]:
        return self.predict_many([text])[0]


@pytest.fixture
def stub() -> StubClassifier:
    return StubClassifier()


@pytest.fixture
def client(stub, monkeypatch) -> TestClient:
    """TestClient wired to the stub, with rate limiting disabled."""
    monkeypatch.setattr(model_module, "_classifier", stub)
    app.state.limiter.enabled = False
    with TestClient(app) as c:
        # Startup kicked off a real background load; point everything back at the stub.
        monkeypatch.setattr(model_module, "_classifier", stub)
        yield c
    app.state.limiter.enabled = True


@pytest.fixture
def loading_client(monkeypatch) -> TestClient:
    """Client whose model has not finished loading — the cold-start path."""
    cold = StubClassifier(ready=False)
    monkeypatch.setattr(model_module, "_classifier", cold)
    app.state.limiter.enabled = False
    with TestClient(app) as c:
        monkeypatch.setattr(model_module, "_classifier", cold)
        yield c
    app.state.limiter.enabled = True


@pytest.fixture
def all_labels() -> tuple[str, ...]:
    return LABELS
