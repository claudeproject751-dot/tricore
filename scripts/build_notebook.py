"""Generates ml/notebooks/emotionsense_train_kaggle.ipynb.

The notebook is the primary training path (free Kaggle T4 ~5 min vs ~45 min on a
laptop CPU). Keeping it generated from this file means the markdown and code stay
diffable and reviewable in normal source control.

Run:  python scripts/build_notebook.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "ml" / "notebooks" / "emotionsense_train_kaggle.ipynb"

MD: list = []
CELLS: list[dict] = []


def md(text: str) -> None:
    CELLS.append({"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(keepends=True)})


def code(text: str) -> None:
    CELLS.append(
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": text.strip("\n").splitlines(keepends=True),
        }
    )


# ----------------------------------------------------------------------------- 0
md(
    """
# EmotionSense — DistilBERT fine-tune on `dair-ai/emotion`

Trains the model that ships in the [EmotionSense](https://github.com/) app: a 6-way
emotion classifier (`sadness`, `joy`, `love`, `anger`, `fear`, `surprise`) built on
`distilbert-base-uncased`.

**Before you run:**

1. **Settings → Accelerator → GPU T4 x2** (or P100). The whole notebook takes ~6 minutes
   on a T4 and well over an hour on CPU.
2. **Settings → Internet → On** (needed to pull the dataset, the base model, and to push).
3. To publish the model: **Add-ons → Secrets → add `HF_TOKEN`** with a
   [write-scoped token](https://huggingface.co/settings/tokens), then set `HF_REPO` in
   the config cell below. Skip this and the notebook still trains and evaluates — it just
   leaves the model in `/kaggle/working` for you to download.

**What it produces** (all under `/kaggle/working/artifacts/`, downloadable from the
Output tab):

| file | used by |
|---|---|
| `emotion-distilbert/` | the model itself — push to the Hub or download |
| `metrics.json` | the app's About page + README (real numbers, never hardcoded) |
| `baseline_metrics.json` | the TF-IDF baseline the transformer must beat |
| `class_distribution.json` / `.png` | dataset section of the About page |
| `confusion_matrix.png` | model card + About page |

Copy `metrics.json`, `baseline_metrics.json`, `class_distribution.json` and the PNGs
back into your repo at `ml/artifacts/` when you're done.
"""
)

# ----------------------------------------------------------------------------- 1
md("## 0 · Configuration\n\nThe only cell you should need to edit.")

code(
    '''
# --- edit me -----------------------------------------------------------------
HF_REPO = "yourusername/emotion-distilbert"   # target Hub repo; used only if PUSH_TO_HUB
PUSH_TO_HUB = True        # needs an HF_TOKEN secret with write scope
PRIVATE_REPO = False
# --- training ----------------------------------------------------------------
EPOCHS = 5
LEARNING_RATE = 2e-5
TRAIN_BATCH_SIZE = 32
EVAL_BATCH_SIZE = 64
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.06
MAX_LENGTH = 96           # dataset texts are short tweets; 96 covers >99.9%
SEED = 42
USE_CLASS_WEIGHTS = False # flip to True only if `surprise`/`love` recall is poor
# -----------------------------------------------------------------------------

BASE_MODEL = "distilbert-base-uncased"
DATASET_ID, DATASET_CONFIG = "dair-ai/emotion", "split"

ID2LABEL = {0: "sadness", 1: "joy", 2: "love", 3: "anger", 4: "fear", 5: "surprise"}
LABEL2ID = {v: k for k, v in ID2LABEL.items()}
LABEL_NAMES = [ID2LABEL[i] for i in range(6)]

# Matches frontend/lib/emotion-theme.ts so every chart in the project agrees.
EMOTION_COLORS = {
    "joy": "#F5B942", "sadness": "#4A7FE0", "love": "#E85D8C",
    "anger": "#E5484D", "fear": "#8B5CF6", "surprise": "#2DD4BF",
}

import os, json, time, random
from pathlib import Path

ARTIFACTS = Path("/kaggle/working/artifacts")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

def write_json(name, payload):
    p = ARTIFACTS / name
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {p}")
    return p

print("config loaded ->", ARTIFACTS)
'''
)

# ----------------------------------------------------------------------------- 2
md(
    """
## 1 · Environment

Kaggle images already carry `torch`, `transformers`, `datasets` and `scikit-learn`.
This pins the versions the project was built against and is a no-op if they already match.
"""
)

code(
    '''
%pip install -q -U "transformers==4.48.0" "datasets==3.2.0" "accelerate==1.3.0" "huggingface-hub==0.27.1"
'''
)

code(
    '''
import numpy as np, torch, transformers, datasets, sklearn

print("torch       ", torch.__version__)
print("transformers", transformers.__version__)
print("datasets    ", datasets.__version__)
print("sklearn     ", sklearn.__version__)

CUDA = torch.cuda.is_available()
DEVICE = "cuda" if CUDA else "cpu"
print("\\ndevice      ", torch.cuda.get_device_name(0) if CUDA else "cpu")
if not CUDA:
    print("\\n!! No GPU detected. Settings -> Accelerator -> GPU T4 x2, then rerun.")
    print("   Training on CPU here will take well over an hour.")

transformers.set_seed(SEED)
random.seed(SEED); np.random.seed(SEED)
'''
)

# ----------------------------------------------------------------------------- 3
md(
    """
## 2 · Data

`dair-ai/emotion` (`split` config) — 16,000 train / 2,000 validation / 2,000 test English
tweets, single-label across 6 emotions. Text is already lowercased and stripped of
punctuation, so whitespace trimming is the only cleaning that is justified.
"""
)

code(
    '''
from collections import Counter
from datasets import load_dataset

ds = load_dataset(DATASET_ID, DATASET_CONFIG)
ds = ds.map(lambda b: {"text": [t.strip() for t in b["text"]]}, batched=True)
ds
'''
)

code(
    '''
dist = {}
for split in ds:
    counts = Counter(ds[split]["label"])
    total = sum(counts.values())
    dist[split] = {
        "total": total,
        "counts": {ID2LABEL[i]: counts.get(i, 0) for i in range(6)},
        "percentages": {ID2LABEL[i]: round(100 * counts.get(i, 0) / total, 2) for i in range(6)},
    }

for split, info in dist.items():
    print(f"\\n{split}  (n={info['total']:,})")
    for name in LABEL_NAMES:
        pct = info["percentages"][name]
        print(f"  {name:<9} {info['counts'][name]:>6,}  {pct:>5.2f}%  {'#' * int(pct / 1.5)}")

ratio = max(dist["train"]["percentages"].values()) / min(dist["train"]["percentages"].values())
print(f"\\nimbalance ratio (most:least frequent) = {ratio:.1f}x")
print("-> `surprise` and `love` are rare; check their recall in the per-class report.")

write_json("class_distribution.json", dist)

lengths = [len(t.split()) for t in ds["train"]["text"]]
print(f"\\ntrain length (words): mean={np.mean(lengths):.1f}  p99={np.percentile(lengths, 99):.0f}  max={max(lengths)}")
print(f"-> MAX_LENGTH={MAX_LENGTH} tokens truncates almost nothing.")
'''
)

code(
    '''
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

splits = list(dist.keys())
fig, axes = plt.subplots(1, len(splits), figsize=(5 * len(splits), 4.2))
fig.patch.set_facecolor("#0A0A0F")
for ax, split in zip(np.atleast_1d(axes), splits):
    counts = [dist[split]["counts"][n] for n in LABEL_NAMES]
    ax.bar(LABEL_NAMES, counts, color=[EMOTION_COLORS[n] for n in LABEL_NAMES], edgecolor="none")
    ax.set_facecolor("#0A0A0F")
    ax.set_title(f"{split}  (n={dist[split]['total']:,})", color="#FAFAFA", pad=12)
    ax.tick_params(colors="#A1A1AA", labelsize=9)
    ax.set_xticks(range(6)); ax.set_xticklabels(LABEL_NAMES, rotation=30, ha="right")
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("bottom", "left"): ax.spines[s].set_color("#27272A")
    for i, c in enumerate(counts):
        ax.text(i, c, f"{c:,}", ha="center", va="bottom", color="#A1A1AA", fontsize=8)
fig.suptitle("dair-ai/emotion — class distribution", color="#FAFAFA", fontsize=14)
fig.tight_layout()
fig.savefig(ARTIFACTS / "class_distribution.png", dpi=150, facecolor="#0A0A0F")
plt.show()
'''
)

# ----------------------------------------------------------------------------- 4
md(
    """
## 3 · Baseline — TF-IDF + LogisticRegression

Runs in under a minute and answers the question that matters before spending GPU time:
*how much does the transformer actually buy us?* Expect ~86–89% accuracy. If the
fine-tune doesn't clearly beat this, something is wrong with the fine-tune.
"""
)

code(
    '''
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from sklearn.pipeline import Pipeline
import joblib

baseline = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=20_000, sublinear_tf=True)),
    ("clf", LogisticRegression(max_iter=1000, class_weight="balanced", n_jobs=-1)),
])

t0 = time.perf_counter()
baseline.fit(ds["train"]["text"], ds["train"]["label"])
fit_s = time.perf_counter() - t0
print(f"fit in {fit_s:.1f}s")

baseline_metrics = {
    "model": "tfidf(1,2)x20000 + LogisticRegression(class_weight=balanced)",
    "train_seconds": round(fit_s, 2),
    "splits": {},
}
for split in ("validation", "test"):
    y_true = ds[split]["label"]
    y_pred = baseline.predict(ds[split]["text"])
    rep = classification_report(y_true, y_pred, target_names=LABEL_NAMES, output_dict=True, zero_division=0)
    baseline_metrics["splits"][split] = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro")), 4),
        "per_class": {n: {k: round(float(v), 4) for k, v in rep[n].items()} for n in LABEL_NAMES},
    }
    m = baseline_metrics["splits"][split]
    print(f"{split}: accuracy={m['accuracy']:.4f}  macro-F1={m['f1_macro']:.4f}")

joblib.dump(baseline, ARTIFACTS / "baseline.joblib")
write_json("baseline_metrics.json", baseline_metrics)
BASELINE_TEST = baseline_metrics["splits"]["test"]
print(f"\\nTarget to beat on test: accuracy {BASELINE_TEST['accuracy']:.4f} / macro-F1 {BASELINE_TEST['f1_macro']:.4f}")
'''
)

# ----------------------------------------------------------------------------- 5
md(
    """
## 4 · Fine-tune DistilBERT

Dynamic padding (`DataCollatorWithPadding`) instead of padding everything to 96 — these
are short tweets, so this alone roughly halves step time. `fp16` on GPU. The best
checkpoint by **validation macro-F1** (not accuracy — macro-F1 is what protects the rare
`surprise` class) is what gets saved.
"""
)

code(
    '''
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, DataCollatorWithPadding,
)

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, max_length=MAX_LENGTH)

ds_tok = ds.map(tokenize, batched=True, remove_columns=["text"])
collator = DataCollatorWithPadding(tokenizer=tokenizer)

model = AutoModelForSequenceClassification.from_pretrained(
    BASE_MODEL, num_labels=6, id2label=ID2LABEL, label2id=LABEL2ID,
)
print(f"{sum(p.numel() for p in model.parameters()):,} parameters")
'''
)

code(
    '''
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": float(accuracy_score(labels, preds)),
        "f1_macro": float(f1_score(labels, preds, average="macro")),
    }

class WeightedLossTrainer(Trainer):
    """Inverse-frequency class weights — only used when USE_CLASS_WEIGHTS is on."""
    def __init__(self, *a, class_weights=None, **kw):
        super().__init__(*a, **kw)
        self.class_weights = class_weights
    def compute_loss(self, model, inputs, return_outputs=False, **kw):
        labels = inputs.pop("labels")
        out = model(**inputs)
        w = self.class_weights.to(out.logits.device) if self.class_weights is not None else None
        loss = torch.nn.functional.cross_entropy(out.logits.view(-1, 6), labels.view(-1), weight=w)
        return (loss, out) if return_outputs else loss

class_weights = None
if USE_CLASS_WEIGHTS:
    counts = np.bincount(ds["train"]["label"], minlength=6)
    w = counts.sum() / (6 * counts)
    class_weights = torch.tensor(w, dtype=torch.float32)
    print("class weights:", np.round(w, 3).tolist())

args = TrainingArguments(
    output_dir="/kaggle/working/checkpoints",
    learning_rate=LEARNING_RATE,
    per_device_train_batch_size=TRAIN_BATCH_SIZE,
    per_device_eval_batch_size=EVAL_BATCH_SIZE,
    num_train_epochs=EPOCHS,
    weight_decay=WEIGHT_DECAY,
    warmup_ratio=WARMUP_RATIO,
    eval_strategy="epoch",
    save_strategy="epoch",
    save_total_limit=2,
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    greater_is_better=True,
    logging_steps=50,
    seed=SEED,
    fp16=CUDA,
    report_to="none",
)

trainer_cls = WeightedLossTrainer if USE_CLASS_WEIGHTS else Trainer
extra = {"class_weights": class_weights} if USE_CLASS_WEIGHTS else {}
trainer = trainer_cls(
    model=model, args=args,
    train_dataset=ds_tok["train"], eval_dataset=ds_tok["validation"],
    processing_class=tokenizer, data_collator=collator,
    compute_metrics=compute_metrics, **extra,
)
'''
)

code(
    '''
t0 = time.perf_counter()
trainer.train()
TRAIN_SECONDS = time.perf_counter() - t0
print(f"\\ntrained in {TRAIN_SECONDS/60:.1f} min")

val = trainer.evaluate()
print(f"best validation: accuracy={val['eval_accuracy']:.4f}  macro-F1={val['eval_f1_macro']:.4f}")
'''
)

code(
    '''
MODEL_DIR = ARTIFACTS / "emotion-distilbert"
trainer.save_model(str(MODEL_DIR))
tokenizer.save_pretrained(str(MODEL_DIR))

write_json("train_history.json", {
    "base_model": BASE_MODEL,
    "device": torch.cuda.get_device_name(0) if CUDA else "cpu",
    "train_seconds": round(TRAIN_SECONDS, 1),
    "hyperparameters": {
        "epochs": EPOCHS, "learning_rate": LEARNING_RATE,
        "train_batch_size": TRAIN_BATCH_SIZE, "weight_decay": WEIGHT_DECAY,
        "warmup_ratio": WARMUP_RATIO, "max_length": MAX_LENGTH,
        "class_weights": USE_CLASS_WEIGHTS, "seed": SEED,
    },
    "best_validation": {
        "accuracy": round(float(val["eval_accuracy"]), 4),
        "f1_macro": round(float(val["eval_f1_macro"]), 4),
    },
    "log_history": trainer.state.log_history,
})
print("saved ->", MODEL_DIR)
'''
)

# ----------------------------------------------------------------------------- 6
md(
    """
## 5 · Evaluate on the held-out test split

The `test` split has not been touched by training or by checkpoint selection, so these
are the only numbers honest enough to put on the About page. `metrics.json` is consumed
directly by the frontend — nothing about the model is hardcoded in the UI.
"""
)

code(
    '''
import platform

@torch.no_grad()
def predict_logits(texts, batch_size=EVAL_BATCH_SIZE):
    model.eval()
    out = []
    for i in range(0, len(texts), batch_size):
        enc = tokenizer(texts[i:i + batch_size], truncation=True, max_length=MAX_LENGTH,
                        padding=True, return_tensors="pt").to(DEVICE)
        out.append(model(**enc).logits.float().cpu().numpy())
    return np.concatenate(out)

model.to(DEVICE)
texts = ds["test"]["text"]
y_true = np.array(ds["test"]["label"])

t0 = time.perf_counter()
logits = predict_logits(texts)
elapsed = time.perf_counter() - t0
y_pred = logits.argmax(axis=-1)

acc = float(accuracy_score(y_true, y_pred))
f1_macro = float(f1_score(y_true, y_pred, average="macro"))
f1_weighted = float(f1_score(y_true, y_pred, average="weighted"))
report = classification_report(y_true, y_pred, target_names=LABEL_NAMES, output_dict=True, zero_division=0)

print(f"accuracy={acc:.4f}  macro-F1={f1_macro:.4f}  weighted-F1={f1_weighted:.4f}\\n")
print(classification_report(y_true, y_pred, target_names=LABEL_NAMES, digits=4, zero_division=0))

delta = f1_macro - BASELINE_TEST["f1_macro"]
print(f"vs TF-IDF baseline macro-F1 {BASELINE_TEST['f1_macro']:.4f}: {delta:+.4f}  "
      f"[{'PASS' if delta > 0 else 'FAIL — investigate before shipping'}]")
'''
)

code(
    '''
cm = confusion_matrix(y_true, y_pred, labels=list(range(6)))
cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)

fig, ax = plt.subplots(figsize=(7.2, 6.2))
fig.patch.set_facecolor("#0A0A0F"); ax.set_facecolor("#0A0A0F")
im = ax.imshow(cm_norm, cmap="magma", vmin=0, vmax=1)
cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.ax.tick_params(colors="#A1A1AA"); cbar.outline.set_edgecolor("#27272A")
ax.set_xticks(range(6), LABEL_NAMES, rotation=35, ha="right")
ax.set_yticks(range(6), LABEL_NAMES)
ax.tick_params(colors="#A1A1AA")
ax.set_xlabel("predicted", color="#FAFAFA", labelpad=10)
ax.set_ylabel("actual", color="#FAFAFA", labelpad=10)
ax.set_title("Confusion matrix — test split (row-normalised)", color="#FAFAFA", pad=16)
for s in ax.spines.values(): s.set_color("#27272A")
for i in range(6):
    for j in range(6):
        ax.text(j, i, f"{cm_norm[i,j]:.2f}\\n{cm[i,j]}", ha="center", va="center", fontsize=8,
                color="#0A0A0F" if cm_norm[i,j] > 0.55 else "#FAFAFA")
fig.tight_layout()
fig.savefig(ARTIFACTS / "confusion_matrix.png", dpi=150, facecolor="#0A0A0F")
plt.show()
'''
)

code(
    '''
metrics = {
    "model": {
        "base": BASE_MODEL,
        "architecture": "DistilBertForSequenceClassification",
        "num_labels": 6,
        "parameters": int(sum(p.numel() for p in model.parameters())),
    },
    "dataset": {
        "id": DATASET_ID, "config": DATASET_CONFIG,
        "splits": {s: ds[s].num_rows for s in ds},
        "license_note": "Research / educational use — see the dataset card.",
        "citation": "Saravia et al., CARER: Contextualized Affect Representations for Emotion Recognition, EMNLP 2018.",
    },
    "evaluation": {
        "split": "test", "n": int(len(y_true)),
        "accuracy": round(acc, 4),
        "f1_macro": round(f1_macro, 4),
        "f1_weighted": round(f1_weighted, 4),
    },
    "per_class": {
        n: {
            "precision": round(float(report[n]["precision"]), 4),
            "recall": round(float(report[n]["recall"]), 4),
            "f1": round(float(report[n]["f1-score"]), 4),
            "support": int(report[n]["support"]),
        } for n in LABEL_NAMES
    },
    "confusion_matrix": {"labels": LABEL_NAMES, "counts": cm.tolist()},
    "baseline_comparison": {
        "accuracy": BASELINE_TEST["accuracy"],
        "f1_macro": BASELINE_TEST["f1_macro"],
    },
    "throughput": {
        "device": DEVICE,
        "hardware": torch.cuda.get_device_name(0) if CUDA else platform.processor(),
        "batch_size": EVAL_BATCH_SIZE,
        "total_seconds": round(elapsed, 2),
        "ms_per_sample": round(1000 * elapsed / len(texts), 2),
    },
}
write_json("metrics.json", metrics)
print(json.dumps(metrics["evaluation"], indent=2))
'''
)

# ----------------------------------------------------------------------------- 7
md(
    """
## 6 · Sanity check — one sentence per emotion

Phase 5's manual test, run here so a bad model never reaches the app. Every row should
predict its intended label. If two or more are wrong, retrain before pushing.
"""
)

code(
    '''
from transformers import pipeline

clf = pipeline("text-classification", model=model, tokenizer=tokenizer,
               top_k=None, device=0 if CUDA else -1)

probes = [
    ("sadness",  "i feel so empty and alone since everyone left"),
    ("joy",      "i cant stop smiling this is the best news all year"),
    ("love",     "i feel so loved and cared for by my family"),
    ("anger",    "i am absolutely furious about how they treated her"),
    ("fear",     "i feel terrified about what might happen tomorrow"),
    ("surprise", "i cant believe this actually happened i am stunned"),
]

ok = 0
for expected, text in probes:
    scores = sorted(clf(text)[0], key=lambda d: -d["score"])
    top = scores[0]
    hit = top["label"] == expected
    ok += hit
    print(f"{'PASS' if hit else 'FAIL'}  expected={expected:<9} got={top['label']:<9} "
          f"p={top['score']:.3f}   \\"{text[:52]}...\\"")
print(f"\\n{ok}/6 correct")
'''
)

# ----------------------------------------------------------------------------- 8
md(
    """
## 7 · Push to the Hugging Face Hub

Needs an `HF_TOKEN` secret (**Add-ons → Secrets**) with **write** scope. The model card
below is generated from the real `metrics.json` — the numbers in it are the ones you just
measured, and the limitations section is not boilerplate.

If `PUSH_TO_HUB = False`, skip this and grab `artifacts/emotion-distilbert/` from the
Output tab instead.
"""
)

code(
    '''
def build_model_card(repo_id, metrics):
    ev, ds_meta = metrics["evaluation"], metrics["dataset"]
    rows = "\\n".join(
        f"| {n} | {m['precision']:.3f} | {m['recall']:.3f} | {m['f1']:.3f} | {m['support']} |"
        for n, m in metrics["per_class"].items()
    )
    b = metrics["baseline_comparison"]
    baseline_line = (
        f"\\nA TF-IDF + LogisticRegression baseline on the same split scores "
        f"**{b['accuracy']:.4f}** accuracy / **{b['f1_macro']:.4f}** macro-F1, so the "
        f"fine-tune adds **{ev['f1_macro'] - b['f1_macro']:+.4f}** macro-F1.\\n"
    )
    name = repo_id.split("/")[-1]
    return f"""---
language: en
license: apache-2.0
library_name: transformers
pipeline_tag: text-classification
tags: [emotion, text-classification, distilbert]
datasets: [dair-ai/emotion]
base_model: {metrics["model"]["base"]}
metrics: [accuracy, f1]
model-index:
  - name: {name}
    results:
      - task: {{type: text-classification, name: Emotion Classification}}
        dataset: {{name: dair-ai/emotion, type: dair-ai/emotion, config: split, split: test}}
        metrics:
          - {{type: accuracy, value: {ev["accuracy"]}}}
          - {{type: f1, value: {ev["f1_macro"]}, name: Macro F1}}
widget:
  - text: "i feel so grateful for everyone who showed up today"
  - text: "i cant believe this actually happened right now"
---

# {name}

`{metrics["model"]["base"]}` fine-tuned for 6-way emotion classification on
[`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion) (`split` config).
Powers the **EmotionSense** web app.

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
```

## Training

Base `{metrics["model"]["base"]}`, max length {MAX_LENGTH}, AdamW at lr {LEARNING_RATE}
with {int(WARMUP_RATIO*100)}% linear warmup, weight decay {WEIGHT_DECAY}, batch size
{TRAIN_BATCH_SIZE}, {EPOCHS} epochs, best checkpoint chosen by validation macro-F1.
Trained on `train` (16,000), selected on `validation` (2,000), reported on `test` (2,000)
which was never seen during training or selection.

## Intended use

Analysing the emotional tone of short, informal English text.

## Limitations and bias

- **Register.** Training data is English tweets, mostly opening with "i feel…". Formal
  prose, long documents and other languages are out of distribution and confidence will
  be poorly calibrated there.
- **Fixed taxonomy.** Every input is forced into one of six classes; neutral, mixed and
  sarcastic text has no correct answer available.
- **Class imbalance.** `surprise` (~3.6% of train) and `love` (~8%) are rare and their
  recall is measurably lower — see the per-class table.
- **Not clinical.** Not a diagnostic instrument. Do not use for mental-health screening,
  hiring, unreviewed moderation, or any decision affecting a person's rights.
- Inherits social biases from the source corpus and from the base model's pretraining.

## Dataset citation

```bibtex
@inproceedings{{saravia-etal-2018-carer,
  title = "{{CARER}}: Contextualized Affect Representations for Emotion Recognition",
  author = "Saravia, Elvis and Liu, Hsien-Chi Toby and Huang, Yen-Hao and Wu, Junlin and Chen, Yi-Shin",
  booktitle = "Proceedings of EMNLP 2018", year = "2018", pages = "3687--3697",
}}
```

Dataset is for **research and educational use** — see the dataset card.
"""

print("model card builder ready")
'''
)

code(
    '''
if PUSH_TO_HUB:
    from huggingface_hub import HfApi

    try:
        from kaggle_secrets import UserSecretsClient
        HF_TOKEN = UserSecretsClient().get_secret("HF_TOKEN")
    except Exception as e:
        HF_TOKEN = os.environ.get("HF_TOKEN")
        if not HF_TOKEN:
            raise SystemExit(
                "No HF_TOKEN. Add-ons -> Secrets -> add HF_TOKEN (write scope), "
                f"or set PUSH_TO_HUB = False.  ({e})"
            )

    if HF_REPO.startswith("yourusername/"):
        raise SystemExit("Set HF_REPO to your own namespace in the config cell.")

    api = HfApi(token=HF_TOKEN)
    api.create_repo(HF_REPO, repo_type="model", private=PRIVATE_REPO, exist_ok=True)

    model.push_to_hub(HF_REPO, token=HF_TOKEN)
    tokenizer.push_to_hub(HF_REPO, token=HF_TOKEN)

    card_path = ARTIFACTS / "README_model_card.md"
    card_path.write_text(build_model_card(HF_REPO, metrics), encoding="utf-8")
    api.upload_file(path_or_fileobj=str(card_path), path_in_repo="README.md",
                    repo_id=HF_REPO, repo_type="model")
    api.upload_file(path_or_fileobj=str(ARTIFACTS / "confusion_matrix.png"),
                    path_in_repo="confusion_matrix.png", repo_id=HF_REPO, repo_type="model")

    print(f"pushed -> https://huggingface.co/{HF_REPO}")
    print(f"\\nNow set MODEL_REPO={HF_REPO} in backend/.env and in the Render dashboard.")
else:
    print("PUSH_TO_HUB is False — download artifacts/emotion-distilbert/ from the Output tab.")
'''
)

# ----------------------------------------------------------------------------- 9
md(
    """
## 8 · Verify the published model

Loads the model back **from the Hub**, exactly as the FastAPI backend will at boot. If
this cell is green, `backend/` will work against it unchanged.
"""
)

code(
    '''
if PUSH_TO_HUB:
    hub_clf = pipeline("text-classification", model=HF_REPO, top_k=None, truncation=True)
    scores = sorted(hub_clf("i am so excited about this")[0], key=lambda d: -d["score"])
    for s in scores:
        print(f"  {s['label']:<9} {s['score']:.4f}  {'#' * int(s['score'] * 40)}")
    print("\\nHub model loads and serves correctly.")
'''
)

md(
    """
---

## 9 · What to copy back into the repo

From the **Output** tab, download and place in `ml/artifacts/`:

- `metrics.json` — required; the About page and README read it
- `baseline_metrics.json`, `class_distribution.json`
- `confusion_matrix.png`, `class_distribution.png`

Then in the repo:

```bash
# backend/.env
MODEL_REPO=yourusername/emotion-distilbert
ALLOWED_ORIGIN=http://localhost:3000

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Do **not** commit `emotion-distilbert/` or `checkpoints/` — the weights live on the Hub,
the repo keeps only the numbers.
"""
)

nb = {
    "cells": CELLS,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.11"},
        "accelerator": "GPU",
        "kaggle": {"accelerator": "nvidiaTeslaT4", "dataSources": [], "isInternetEnabled": True},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(nb, indent=1), encoding="utf-8")
print(f"wrote {OUT}  ({len(CELLS)} cells)")
