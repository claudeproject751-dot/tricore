"""Phase 1.1 — load `dair-ai/emotion`, inspect class balance, log artifacts.

Run:  python ml/data_prep.py
Outputs:
  artifacts/class_distribution.json
  artifacts/class_distribution.png
  artifacts/dataset_summary.json
"""

from __future__ import annotations

from collections import Counter

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from datasets import DatasetDict, load_dataset

from common import (
    ARTIFACTS,
    DATASET_CONFIG,
    DATASET_ID,
    EMOTION_COLORS,
    ID2LABEL,
    LABEL_NAMES,
    banner,
    write_json,
)


def load() -> DatasetDict:
    """Load the dataset and strip whitespace. The corpus is already lowercased
    and punctuation-free, so no heavier cleaning is warranted."""
    ds = load_dataset(DATASET_ID, DATASET_CONFIG)
    return ds.map(lambda b: {"text": [t.strip() for t in b["text"]]}, batched=True)


def distribution(ds: DatasetDict) -> dict:
    out: dict[str, dict] = {}
    for split in ds:
        counts = Counter(ds[split]["label"])
        total = sum(counts.values())
        out[split] = {
            "total": total,
            "counts": {ID2LABEL[i]: counts.get(i, 0) for i in range(len(ID2LABEL))},
            "percentages": {
                ID2LABEL[i]: round(100 * counts.get(i, 0) / total, 2) for i in range(len(ID2LABEL))
            },
        }
    return out


def plot(dist: dict) -> None:
    splits = list(dist.keys())
    fig, axes = plt.subplots(1, len(splits), figsize=(5 * len(splits), 4.2), sharey=False)
    if len(splits) == 1:
        axes = [axes]

    fig.patch.set_facecolor("#0A0A0F")
    for ax, split in zip(axes, splits):
        counts = [dist[split]["counts"][name] for name in LABEL_NAMES]
        colors = [EMOTION_COLORS[name] for name in LABEL_NAMES]
        ax.bar(LABEL_NAMES, counts, color=colors, edgecolor="none")
        ax.set_facecolor("#0A0A0F")
        ax.set_title(f"{split}  (n={dist[split]['total']:,})", color="#FAFAFA", fontsize=12, pad=12)
        ax.tick_params(colors="#A1A1AA", labelsize=9)
        ax.set_xticks(range(len(LABEL_NAMES)))
        ax.set_xticklabels(LABEL_NAMES, rotation=30, ha="right")
        for spine in ("top", "right"):
            ax.spines[spine].set_visible(False)
        for spine in ("bottom", "left"):
            ax.spines[spine].set_color("#27272A")
        for i, c in enumerate(counts):
            ax.text(i, c, f"{c:,}", ha="center", va="bottom", color="#A1A1AA", fontsize=8)

    fig.suptitle("dair-ai/emotion — class distribution", color="#FAFAFA", fontsize=14)
    fig.tight_layout()
    path = ARTIFACTS / "class_distribution.png"
    fig.savefig(path, dpi=150, facecolor="#0A0A0F")
    plt.close(fig)
    print(f"  wrote {path.relative_to(ARTIFACTS.parent.parent)}")


def main() -> None:
    banner("Phase 1.1 — Data preparation")
    ds = load()

    lengths = [len(t) for t in ds["train"]["text"]]
    word_counts = [len(t.split()) for t in ds["train"]["text"]]
    summary = {
        "dataset": f"{DATASET_ID}:{DATASET_CONFIG}",
        "splits": {s: ds[s].num_rows for s in ds},
        "labels": ID2LABEL,
        "train_text_chars": {
            "min": min(lengths),
            "max": max(lengths),
            "mean": round(sum(lengths) / len(lengths), 1),
        },
        "train_text_words": {
            "min": min(word_counts),
            "max": max(word_counts),
            "mean": round(sum(word_counts) / len(word_counts), 1),
        },
    }

    dist = distribution(ds)
    for split, info in dist.items():
        print(f"\n  {split} (n={info['total']:,})")
        for name in LABEL_NAMES:
            pct = info["percentages"][name]
            bar = "#" * int(pct / 1.5)
            print(f"    {name:<9} {info['counts'][name]:>6,}  {pct:>5.2f}%  {bar}")

    write_json(ARTIFACTS / "class_distribution.json", dist)
    write_json(ARTIFACTS / "dataset_summary.json", summary)
    plot(dist)

    imbalance = max(dist["train"]["percentages"].values()) / min(
        dist["train"]["percentages"].values()
    )
    print(f"\n  Imbalance ratio (most:least frequent class) = {imbalance:.1f}x")
    print("  -> `surprise` and `love` are rare; watch their per-class recall in evaluate.py.")


if __name__ == "__main__":
    main()
