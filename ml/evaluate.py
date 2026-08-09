"""Phase 1.4 — score the fine-tuned model on the untouched *test* split.

Run:  python ml/evaluate.py [--model-dir artifacts/emotion-distilbert]

Outputs:
  artifacts/metrics.json          <- the About page cites these numbers verbatim
  artifacts/confusion_matrix.png
"""

from __future__ import annotations

import argparse
import platform
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from common import (
    ARTIFACTS,
    BASE_MODEL,
    DATASET_CONFIG,
    DATASET_ID,
    LABEL_NAMES,
    banner,
    read_json,
    write_json,
)
from data_prep import load

DEFAULT_MODEL_DIR = ARTIFACTS / "emotion-distilbert"


def predict_all(model, tokenizer, texts: list[str], batch_size: int, device: str) -> np.ndarray:
    preds: list[np.ndarray] = []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            enc = tokenizer(
                texts[i : i + batch_size],
                truncation=True,
                max_length=96,
                padding=True,
                return_tensors="pt",
            ).to(device)
            preds.append(model(**enc).logits.cpu().numpy())
    return np.concatenate(preds)


def plot_confusion(cm: np.ndarray, path: Path) -> None:
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)
    fig, ax = plt.subplots(figsize=(7.2, 6.2))
    fig.patch.set_facecolor("#0A0A0F")
    ax.set_facecolor("#0A0A0F")

    im = ax.imshow(cm_norm, cmap="magma", vmin=0, vmax=1)
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.tick_params(colors="#A1A1AA")
    cbar.outline.set_edgecolor("#27272A")

    ax.set_xticks(range(len(LABEL_NAMES)), LABEL_NAMES, rotation=35, ha="right")
    ax.set_yticks(range(len(LABEL_NAMES)), LABEL_NAMES)
    ax.tick_params(colors="#A1A1AA")
    ax.set_xlabel("predicted", color="#FAFAFA", labelpad=10)
    ax.set_ylabel("actual", color="#FAFAFA", labelpad=10)
    ax.set_title("Confusion matrix — test split (row-normalised)", color="#FAFAFA", pad=16)
    for spine in ax.spines.values():
        spine.set_color("#27272A")

    for i in range(len(LABEL_NAMES)):
        for j in range(len(LABEL_NAMES)):
            ax.text(
                j,
                i,
                f"{cm_norm[i, j]:.2f}\n{cm[i, j]}",
                ha="center",
                va="center",
                fontsize=8,
                color="#0A0A0F" if cm_norm[i, j] > 0.55 else "#FAFAFA",
            )

    fig.tight_layout()
    fig.savefig(path, dpi=150, facecolor="#0A0A0F")
    plt.close(fig)
    print(f"  wrote {path.name}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    p.add_argument("--batch-size", type=int, default=64)
    args = p.parse_args()

    banner("Phase 1.4 — Test-set evaluation")
    if not Path(args.model_dir).exists():
        raise SystemExit(
            f"Model not found at {args.model_dir}.\n"
            "Train it first (python ml/train_transformer.py) or pass --model-dir with a\n"
            "Hugging Face repo id you have already pushed."
        )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(str(args.model_dir))
    model = AutoModelForSequenceClassification.from_pretrained(str(args.model_dir)).to(device)

    ds = load()
    texts = ds["test"]["text"]
    y_true = np.array(ds["test"]["label"])

    t0 = time.perf_counter()
    logits = predict_all(model, tokenizer, texts, args.batch_size, device)
    elapsed = time.perf_counter() - t0
    y_pred = logits.argmax(axis=-1)

    acc = float(accuracy_score(y_true, y_pred))
    f1_macro = float(f1_score(y_true, y_pred, average="macro"))
    f1_weighted = float(f1_score(y_true, y_pred, average="weighted"))
    report = classification_report(
        y_true, y_pred, target_names=LABEL_NAMES, output_dict=True, zero_division=0
    )

    print(f"\n  accuracy={acc:.4f}  macro-F1={f1_macro:.4f}  weighted-F1={f1_weighted:.4f}")
    print(classification_report(y_true, y_pred, target_names=LABEL_NAMES, digits=4, zero_division=0))

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(LABEL_NAMES))))
    plot_confusion(cm, ARTIFACTS / "confusion_matrix.png")

    baseline_path = ARTIFACTS / "baseline_metrics.json"
    baseline = None
    if baseline_path.exists():
        b = read_json(baseline_path)["splits"].get("test")
        if b:
            baseline = {"accuracy": b["accuracy"], "f1_macro": b["f1_macro"]}

    metrics = {
        "model": {
            "base": BASE_MODEL,
            "architecture": "DistilBertForSequenceClassification",
            "num_labels": len(LABEL_NAMES),
            "parameters": int(sum(p.numel() for p in model.parameters())),
        },
        "dataset": {
            "id": DATASET_ID,
            "config": DATASET_CONFIG,
            "splits": {s: ds[s].num_rows for s in ds},
            "license_note": "Research / educational use — see the dataset card.",
            "citation": "Saravia et al., CARER: Contextualized Affect Representations for Emotion Recognition, EMNLP 2018.",
        },
        "evaluation": {
            "split": "test",
            "n": int(len(y_true)),
            "accuracy": round(acc, 4),
            "f1_macro": round(f1_macro, 4),
            "f1_weighted": round(f1_weighted, 4),
        },
        "per_class": {
            name: {
                "precision": round(float(report[name]["precision"]), 4),
                "recall": round(float(report[name]["recall"]), 4),
                "f1": round(float(report[name]["f1-score"]), 4),
                "support": int(report[name]["support"]),
            }
            for name in LABEL_NAMES
        },
        "confusion_matrix": {"labels": LABEL_NAMES, "counts": cm.tolist()},
        "baseline_comparison": baseline,
        "throughput": {
            "device": device,
            "hardware": platform.processor() or platform.machine(),
            "batch_size": args.batch_size,
            "total_seconds": round(elapsed, 2),
            "ms_per_sample": round(1000 * elapsed / len(texts), 2),
        },
    }
    write_json(ARTIFACTS / "metrics.json", metrics)

    if baseline:
        delta = f1_macro - baseline["f1_macro"]
        verdict = "PASS" if delta > 0 else "FAIL — transformer does not beat the baseline"
        print(f"\n  vs baseline macro-F1 {baseline['f1_macro']:.4f}: {delta:+.4f}  [{verdict}]")


if __name__ == "__main__":
    main()
