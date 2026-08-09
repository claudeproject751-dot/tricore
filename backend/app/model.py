"""Model loading and inference.

Design notes
------------
* The classifier is loaded **once**, in a background thread at app startup, so a
  cold container answers `/api/health` immediately with `status: "loading"`
  instead of hanging the first request for 30-60s. The frontend uses that signal
  to show a "waking up the model" state rather than a blank screen.
* If the transformer cannot be loaded (no network, bad repo id, OOM), we fall
  back to the TF-IDF baseline from `ml/artifacts/baseline.joblib` when present.
  A degraded-but-honest API beats a 503 — `model_source` on every response and
  `/api/health` both say which model actually answered.
* Inference runs in a worker thread (`run_in_threadpool`) because torch is
  blocking and would otherwise stall the event loop.
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Any, Literal

from .config import Settings

log = logging.getLogger("emotionsense.model")

LABELS: tuple[str, ...] = ("sadness", "joy", "love", "anger", "fear", "surprise")

EMOJI: dict[str, str] = {
    "sadness": "😔",
    "joy": "😊",
    "love": "🥰",
    "anger": "😠",
    "fear": "😨",
    "surprise": "😮",
}

ModelSource = Literal["transformer", "baseline", "none"]


class ModelNotReady(RuntimeError):
    """Raised while the classifier is still downloading/initialising."""


class EmotionClassifier:
    """Thread-safe holder for whichever model is currently able to serve."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._pipeline: Any | None = None
        self._baseline: Any | None = None
        self._source: ModelSource = "none"
        self._error: str | None = None
        self._loading = False
        self._warm = False
        self.started_at = time.monotonic()

    # ---------------------------------------------------------------- state

    @property
    def source(self) -> ModelSource:
        return self._source

    @property
    def ready(self) -> bool:
        return self._source != "none"

    @property
    def warm(self) -> bool:
        return self._warm

    @property
    def error(self) -> str | None:
        return self._error

    @property
    def name(self) -> str:
        if self._source == "transformer":
            return self._settings.model_repo
        if self._source == "baseline":
            return "tfidf+logreg (fallback)"
        return "unloaded"

    def status(self) -> Literal["ok", "loading", "degraded"]:
        if self._source == "transformer":
            return "ok"
        if self._source == "baseline":
            return "degraded"
        return "loading" if self._loading else "degraded"

    # --------------------------------------------------------------- loading

    def load(self) -> None:
        """Blocking load. Called on a background thread at startup."""
        with self._lock:
            if self.ready or self._loading:
                return
            self._loading = True

        try:
            self._load_transformer()
        except Exception as exc:  # noqa: BLE001 - we intentionally degrade, not crash
            self._error = f"{type(exc).__name__}: {exc}"
            log.error("transformer load failed (%s); trying baseline", self._error)
            try:
                self._load_baseline()
            except Exception as exc2:  # noqa: BLE001
                log.error("baseline load failed too: %s", exc2)
                self._error = f"{self._error} | baseline: {exc2}"
        finally:
            self._loading = False

    def _load_transformer(self) -> None:
        from transformers import pipeline  # imported lazily to keep startup light

        repo = self._settings.model_repo
        local = Path(repo)
        target = str(local) if local.exists() else repo
        log.info("loading transformer from %s", target)

        t0 = time.perf_counter()
        clf = pipeline(
            "text-classification",
            model=target,
            top_k=None,  # return every class score, not just the argmax
            truncation=True,
            max_length=96,
            token=self._settings.hf_token,
        )
        labels = {v.lower() for v in clf.model.config.id2label.values()}
        missing = set(LABELS) - labels
        if missing:
            raise ValueError(
                f"model {target!r} does not expose the expected labels; missing {sorted(missing)}"
            )

        self._pipeline = clf
        self._source = "transformer"
        self._error = None
        log.info("transformer ready in %.1fs", time.perf_counter() - t0)

    def _load_baseline(self) -> None:
        path = self._settings.baseline_path
        if not path.exists():
            raise FileNotFoundError(f"no baseline model at {path}")
        import joblib

        self._baseline = joblib.load(path)
        self._source = "baseline"
        log.warning("serving from the TF-IDF baseline — predictions will be less accurate")

    # ------------------------------------------------------------- inference

    def predict_many(self, texts: list[str]) -> list[list[dict[str, float]]]:
        """Score every text. Returns one descending-sorted score list per input."""
        if not self.ready:
            raise ModelNotReady(self._error or "model is still loading")

        if self._source == "transformer":
            raw = self._pipeline(texts)
            # `top_k=None` yields a list of score-dicts per input; a single input
            # is still wrapped in a list by the pipeline.
            out = [
                sorted(
                    ({"label": d["label"].lower(), "score": float(d["score"])} for d in scores),
                    key=lambda d: -d["score"],
                )
                for scores in raw
            ]
        else:
            probs = self._baseline.predict_proba(texts)
            classes = [LABELS[int(c)] for c in self._baseline.classes_]
            out = [
                sorted(
                    ({"label": lab, "score": float(p)} for lab, p in zip(classes, row)),
                    key=lambda d: -d["score"],
                )
                for row in probs
            ]

        self._warm = True
        return out

    def predict(self, text: str) -> list[dict[str, float]]:
        return self.predict_many([text])[0]


_classifier: EmotionClassifier | None = None


def init_classifier(settings: Settings, *, background: bool = True) -> EmotionClassifier:
    """Create the singleton and start loading. Idempotent."""
    global _classifier
    if _classifier is None:
        _classifier = EmotionClassifier(settings)
    if background:
        threading.Thread(target=_classifier.load, name="model-load", daemon=True).start()
    else:
        _classifier.load()
    return _classifier


def get_classifier() -> EmotionClassifier:
    if _classifier is None:
        raise RuntimeError("classifier not initialised — app startup did not run")
    return _classifier


def reset_classifier() -> None:
    """Test hook."""
    global _classifier
    _classifier = None
