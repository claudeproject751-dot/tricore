"""Tests for the classifier wrapper itself.

The tests that touch real weights are opt-in — they download ~250MB and are not
something CI should do on every push:

    RUN_MODEL_TESTS=1 pytest backend/tests/test_model.py
"""

from __future__ import annotations

import os

import pytest

from app.config import Settings
from app.model import EMOJI, LABELS, EmotionClassifier, ModelNotReady

REAL = pytest.mark.skipif(
    os.getenv("RUN_MODEL_TESTS") != "1",
    reason="set RUN_MODEL_TESTS=1 to exercise the real model download",
)


def test_every_label_has_an_emoji():
    assert set(EMOJI) == set(LABELS)


def test_unloaded_classifier_refuses_to_predict(tmp_path):
    clf = EmotionClassifier(Settings(model_repo=str(tmp_path / "nope"), _env_file=None))
    assert clf.ready is False
    assert clf.status() == "degraded"
    with pytest.raises(ModelNotReady):
        clf.predict("i feel happy")


class FakeBaseline:
    """Stand-in for the TF-IDF pipeline. Module level so joblib can pickle it."""

    classes_ = list(range(len(LABELS)))

    def predict_proba(self, texts):
        row = [1 / len(LABELS)] * len(LABELS)
        return [row for _ in texts]


def test_falls_back_to_baseline_when_transformer_is_unavailable(tmp_path, monkeypatch):
    """A broken MODEL_REPO must degrade to the baseline, not take the API down."""
    baseline_path = tmp_path / "baseline.joblib"

    import joblib

    joblib.dump(FakeBaseline(), baseline_path)

    settings = Settings(
        model_repo="this-org/does-not-exist-xyz", baseline_path=baseline_path, _env_file=None
    )
    clf = EmotionClassifier(settings)
    monkeypatch.setattr(
        clf, "_load_transformer", lambda: (_ for _ in ()).throw(OSError("no network"))
    )

    clf.load()

    assert clf.source == "baseline"
    assert clf.status() == "degraded"
    assert clf.error is not None

    scores = clf.predict("i feel happy")
    assert len(scores) == len(LABELS)
    assert {s["label"] for s in scores} == set(LABELS)
    assert sum(s["score"] for s in scores) == pytest.approx(1.0)


def test_load_failure_without_baseline_leaves_model_unloaded(tmp_path, monkeypatch):
    settings = Settings(
        model_repo="this-org/does-not-exist-xyz",
        baseline_path=tmp_path / "missing.joblib",
        _env_file=None,
    )
    clf = EmotionClassifier(settings)
    monkeypatch.setattr(
        clf, "_load_transformer", lambda: (_ for _ in ()).throw(OSError("no network"))
    )

    clf.load()

    assert clf.ready is False
    assert "no network" in clf.error


@REAL
def test_real_model_scores_the_six_classes():
    clf = EmotionClassifier(Settings(_env_file=None))
    clf.load()
    assert clf.source == "transformer"

    scores = clf.predict("i cant stop smiling this is the best news all year")
    assert {s["label"] for s in scores} == set(LABELS)
    assert scores == sorted(scores, key=lambda s: -s["score"])
    assert scores[0]["label"] == "joy"


@REAL
@pytest.mark.parametrize(
    ("expected", "text"),
    [
        ("sadness", "i feel so empty and alone since everyone left"),
        ("joy", "i cant stop smiling this is the best news all year"),
        ("love", "i feel so loved and cared for by my family"),
        ("anger", "i am absolutely furious about how they treated her"),
        ("fear", "i feel terrified about what might happen tomorrow"),
        ("surprise", "i cant believe this actually happened i am stunned"),
    ],
)
def test_real_model_manual_probe_set(expected, text):
    """Phase 5's manual check, automated: one representative sentence per emotion."""
    clf = EmotionClassifier(Settings(_env_file=None))
    clf.load()
    assert clf.predict(text)[0]["label"] == expected
