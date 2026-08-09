"""Phase 1.5 — push the fine-tuned model + a real model card to the Hugging Face Hub.

Requires HF_TOKEN (write scope) in ml/.env or the environment.

Run:  python ml/push_to_hub.py --repo yourusername/emotion-distilbert
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import HfApi
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from common import ARTIFACTS, ML_DIR, LABEL_NAMES, banner, read_json

load_dotenv(ML_DIR / ".env")

DEFAULT_MODEL_DIR = ARTIFACTS / "emotion-distilbert"


def model_card(repo_id: str, metrics: dict) -> str:
    ev = metrics["evaluation"]
    ds = metrics["dataset"]
    rows = "\n".join(
        f"| {name} | {m['precision']:.3f} | {m['recall']:.3f} | {m['f1']:.3f} | {m['support']} |"
        for name, m in metrics["per_class"].items()
    )
    baseline = metrics.get("baseline_comparison")
    baseline_line = (
        f"\nA TF-IDF + LogisticRegression baseline on the same split scores "
        f"**{baseline['accuracy']:.4f}** accuracy / **{baseline['f1_macro']:.4f}** macro-F1, "
        f"so the fine-tune adds **{ev['f1_macro'] - baseline['f1_macro']:+.4f}** macro-F1.\n"
        if baseline
        else ""
    )

    return f"""---
language: en
license: apache-2.0
library_name: transformers
pipeline_tag: text-classification
tags:
  - emotion
  - text-classification
  - distilbert
datasets:
  - dair-ai/emotion
base_model: {metrics["model"]["base"]}
metrics:
  - accuracy
  - f1
model-index:
  - name: {repo_id.split("/")[-1]}
    results:
      - task:
          type: text-classification
          name: Emotion Classification
        dataset:
          name: dair-ai/emotion
          type: dair-ai/emotion
          config: split
          split: test
        metrics:
          - type: accuracy
            value: {ev["accuracy"]}
          - type: f1
            value: {ev["f1_macro"]}
            name: Macro F1
widget:
  - text: "i feel so grateful for everyone who showed up today"
  - text: "i cant believe this actually happened right now"
  - text: "i am absolutely furious about how this was handled"
---

# {repo_id.split("/")[-1]}

`{metrics["model"]["base"]}` fine-tuned for 6-way emotion classification on
[`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion) (`split` config).
It powers [EmotionSense](https://github.com/), a real-time emotion-intelligence web app.

**Labels:** {", ".join(f"`{n}`" for n in LABEL_NAMES)}

## Results — held-out test split (n={ev["n"]:,})

| metric | value |
|---|---|
| accuracy | **{ev["accuracy"]:.4f}** |
| macro F1 | **{ev["f1_macro"]:.4f}** |
| weighted F1 | **{ev["f1_weighted"]:.4f}** |
{baseline_line}
### Per class

| label | precision | recall | F1 | support |
|---|---|---|---|---|
{rows}

## Usage

```python
from transformers import pipeline

clf = pipeline("text-classification", model="{repo_id}", top_k=None)
clf("i cant stop smiling after that message")
# [{{'label': 'joy', 'score': 0.99...}}, ...]
```

## Training

| hyperparameter | value |
|---|---|
| base model | {metrics["model"]["base"]} |
| max sequence length | 96 |
| optimizer | AdamW |
| learning rate | 2e-5 (6% linear warmup) |
| weight decay | 0.01 |
| batch size | 32 |
| epochs | 5, best checkpoint by validation macro-F1 |

Trained on the 16,000-row `train` split, model selection on the 2,000-row
`validation` split, and reported here on the 2,000-row `test` split, which was
never seen during training or selection.

## Intended use

Analysing the emotional tone of short, informal English text — social posts,
messages, feedback, journal entries.

## Limitations and bias

- **Register.** The training corpus is English tweets, most of which start with
  "i feel…". Formal prose, long documents, and non-English text are out of
  distribution and confidence will be poorly calibrated.
- **Fixed taxonomy.** Every input is forced into one of six classes. Neutral,
  mixed, and sarcastic text has no correct answer available to the model.
- **Class imbalance.** `surprise` (~3.6%) and `love` (~8%) are rare in training;
  their recall is measurably lower — see the per-class table.
- **Not clinical.** This is not a diagnostic instrument and must not be used for
  mental-health screening, hiring, moderation-without-review, or any decision
  affecting a person's rights or wellbeing.
- Inherits the social biases present in the source corpus and in
  `{metrics["model"]["base"]}`'s pretraining data.

## Dataset citation

```bibtex
@inproceedings{{saravia-etal-2018-carer,
    title = "{{CARER}}: Contextualized Affect Representations for Emotion Recognition",
    author = "Saravia, Elvis and Liu, Hsien-Chi Toby and Huang, Yen-Hao and Wu, Junlin and Chen, Yi-Shin",
    booktitle = "Proceedings of the 2018 Conference on Empirical Methods in Natural Language Processing",
    year = "2018",
    publisher = "Association for Computational Linguistics",
    pages = "3687--3697",
}}
```

The dataset card states the data is for **research and educational use**. {ds["license_note"]}
"""


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default=os.getenv("MODEL_REPO"), help="target repo id (user/name)")
    p.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    p.add_argument("--private", action="store_true")
    args = p.parse_args()

    banner("Phase 1.5 — Push to Hugging Face Hub")

    token = os.getenv("HF_TOKEN")
    if not token:
        raise SystemExit("HF_TOKEN is not set. Copy ml/.env.example to ml/.env and fill it in.")
    if not args.repo or args.repo.startswith("yourusername/"):
        raise SystemExit("Pass a real --repo (e.g. --repo myname/emotion-distilbert).")
    if not args.model_dir.exists():
        raise SystemExit(f"No model at {args.model_dir}. Run train_transformer.py first.")

    metrics_path = ARTIFACTS / "metrics.json"
    if not metrics_path.exists():
        raise SystemExit("artifacts/metrics.json missing. Run evaluate.py first — the model")
    metrics = read_json(metrics_path)

    api = HfApi(token=token)
    api.create_repo(args.repo, repo_type="model", private=args.private, exist_ok=True)
    print(f"  repo ready: https://huggingface.co/{args.repo}")

    model = AutoModelForSequenceClassification.from_pretrained(str(args.model_dir))
    tokenizer = AutoTokenizer.from_pretrained(str(args.model_dir))
    model.push_to_hub(args.repo, token=token)
    tokenizer.push_to_hub(args.repo, token=token)
    print("  pushed model + tokenizer")

    card = ARTIFACTS / "README_model_card.md"
    card.write_text(model_card(args.repo, metrics), encoding="utf-8")
    api.upload_file(
        path_or_fileobj=str(card), path_in_repo="README.md", repo_id=args.repo, repo_type="model"
    )
    print("  pushed model card")

    cm = ARTIFACTS / "confusion_matrix.png"
    if cm.exists():
        api.upload_file(
            path_or_fileobj=str(cm),
            path_in_repo="confusion_matrix.png",
            repo_id=args.repo,
            repo_type="model",
        )
        print("  pushed confusion matrix")

    print(f"\n  Done. Set MODEL_REPO={args.repo} in backend/.env and on Render.")


if __name__ == "__main__":
    main()
