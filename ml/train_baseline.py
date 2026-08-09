"""Phase 1.2 — TF-IDF + LogisticRegression sanity-check baseline.

This is *not* the shipped model. It exists to (a) prove the data pipeline,
(b) set a number the transformer must clearly beat, and (c) act as a cheap
offline fallback the backend can serve if the transformer is unavailable.

Run:  python ml/train_baseline.py
Outputs:
  artifacts/baseline.joblib
  artifacts/baseline_metrics.json
"""

from __future__ import annotations

import time

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.pipeline import Pipeline

from common import ARTIFACTS, LABEL_NAMES, banner, write_json
from data_prep import load


def build() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(ngram_range=(1, 2), max_features=20_000, sublinear_tf=True),
            ),
            (
                "clf",
                LogisticRegression(max_iter=1000, class_weight="balanced", n_jobs=-1),
            ),
        ]
    )


def main() -> None:
    banner("Phase 1.2 — TF-IDF + LogisticRegression baseline")
    ds = load()

    pipe = build()
    t0 = time.perf_counter()
    pipe.fit(ds["train"]["text"], ds["train"]["label"])
    fit_seconds = time.perf_counter() - t0
    print(f"  fit in {fit_seconds:.1f}s")

    metrics: dict = {
        "model": "tfidf(1,2)x20000 + LogisticRegression(class_weight=balanced)",
        "train_seconds": round(fit_seconds, 2),
        "splits": {},
    }

    for split in ("validation", "test"):
        y_true = ds[split]["label"]
        y_pred = pipe.predict(ds[split]["text"])
        acc = accuracy_score(y_true, y_pred)
        f1m = f1_score(y_true, y_pred, average="macro")
        report = classification_report(
            y_true, y_pred, target_names=LABEL_NAMES, output_dict=True, zero_division=0
        )
        metrics["splits"][split] = {
            "accuracy": round(float(acc), 4),
            "f1_macro": round(float(f1m), 4),
            "per_class": {
                name: {k: round(float(v), 4) for k, v in report[name].items()}
                for name in LABEL_NAMES
            },
        }
        print(f"\n  {split}: accuracy={acc:.4f}  macro-F1={f1m:.4f}")
        print(
            classification_report(
                y_true, y_pred, target_names=LABEL_NAMES, digits=4, zero_division=0
            )
        )

    joblib.dump(pipe, ARTIFACTS / "baseline.joblib")
    print(f"  wrote artifacts/baseline.joblib")
    write_json(ARTIFACTS / "baseline_metrics.json", metrics)

    val = metrics["splits"]["validation"]
    print(
        f"\n  Target for the transformer: beat validation accuracy "
        f"{val['accuracy']:.4f} / macro-F1 {val['f1_macro']:.4f}."
    )


if __name__ == "__main__":
    main()
