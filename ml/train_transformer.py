"""Phase 1.3 — fine-tune DistilBERT on `dair-ai/emotion`. This is the shipped model.

Run (GPU, recommended — Kaggle/Colab T4):
    python ml/train_transformer.py
Run (CPU laptop, trimmed schedule):
    python ml/train_transformer.py --epochs 3 --batch-size 16

Outputs:
  artifacts/emotion-distilbert/        (model + tokenizer, ready to push)
  artifacts/train_history.json
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from common import (
    ARTIFACTS,
    BASE_MODEL,
    ID2LABEL,
    LABEL2ID,
    MAX_LENGTH,
    banner,
    write_json,
)
from data_prep import load

OUTPUT_DIR = ARTIFACTS / "emotion-distilbert"


def compute_metrics(eval_pred) -> dict[str, float]:
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": float(accuracy_score(labels, preds)),
        "f1_macro": float(f1_score(labels, preds, average="macro")),
    }


class WeightedLossTrainer(Trainer):
    """Trainer with per-class loss weights.

    Only used with `--class-weights`: the dataset is imbalanced (`surprise` is
    ~3.6% of train), and if plain fine-tuning under-serves the rare classes this
    recovers their recall at a small cost to overall accuracy.
    """

    def __init__(self, *args, class_weights: torch.Tensor | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.class_weights = class_weights

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        weight = (
            self.class_weights.to(outputs.logits.device)
            if self.class_weights is not None
            else None
        )
        loss = torch.nn.functional.cross_entropy(
            outputs.logits.view(-1, model.config.num_labels), labels.view(-1), weight=weight
        )
        return (loss, outputs) if return_outputs else loss


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fine-tune DistilBERT for emotion classification.")
    p.add_argument("--epochs", type=float, default=5.0)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--eval-batch-size", type=int, default=64)
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--weight-decay", type=float, default=0.01)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--max-length", type=int, default=MAX_LENGTH)
    p.add_argument(
        "--class-weights",
        action="store_true",
        help="Use inverse-frequency class weights in the loss.",
    )
    p.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    banner("Phase 1.3 — DistilBERT fine-tune")

    has_cuda = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if has_cuda else "cpu"
    print(f"  device: {device_name}  |  torch {torch.__version__}")
    if not has_cuda:
        print("  note: CPU training of 16k rows takes ~30-60 min. A free Kaggle/Colab")
        print("        T4 finishes the same run in ~5 min — see ml/notebooks/.")

    ds = load()
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=args.max_length)

    ds_tok = ds.map(tokenize, batched=True, remove_columns=["text"])
    collator = DataCollatorWithPadding(tokenizer=tokenizer)

    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL, num_labels=len(ID2LABEL), id2label=ID2LABEL, label2id=LABEL2ID
    )

    class_weights = None
    if args.class_weights:
        counts = np.bincount(ds["train"]["label"], minlength=len(ID2LABEL))
        weights = counts.sum() / (len(counts) * counts)
        class_weights = torch.tensor(weights, dtype=torch.float32)
        print(f"  class weights: {np.round(weights, 3).tolist()}")

    training_args = TrainingArguments(
        output_dir=str(ARTIFACTS / "checkpoints"),
        learning_rate=args.lr,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.eval_batch_size,
        num_train_epochs=args.epochs,
        weight_decay=args.weight_decay,
        warmup_ratio=0.06,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=50,
        seed=args.seed,
        fp16=has_cuda,
        dataloader_num_workers=0,
        report_to="none",
    )

    trainer_cls = WeightedLossTrainer if args.class_weights else Trainer
    extra = {"class_weights": class_weights} if args.class_weights else {}
    trainer = trainer_cls(
        model=model,
        args=training_args,
        train_dataset=ds_tok["train"],
        eval_dataset=ds_tok["validation"],
        processing_class=tokenizer,
        data_collator=collator,
        compute_metrics=compute_metrics,
        **extra,
    )

    t0 = time.perf_counter()
    trainer.train()
    train_seconds = time.perf_counter() - t0

    val = trainer.evaluate()
    print(
        f"\n  best validation: accuracy={val['eval_accuracy']:.4f} "
        f"macro-F1={val['eval_f1_macro']:.4f}  ({train_seconds/60:.1f} min)"
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(args.output_dir))
    tokenizer.save_pretrained(str(args.output_dir))
    print(f"  saved model -> {args.output_dir}")

    write_json(
        ARTIFACTS / "train_history.json",
        {
            "base_model": BASE_MODEL,
            "device": device_name,
            "train_seconds": round(train_seconds, 1),
            "hyperparameters": {
                "epochs": args.epochs,
                "learning_rate": args.lr,
                "train_batch_size": args.batch_size,
                "weight_decay": args.weight_decay,
                "warmup_ratio": 0.06,
                "max_length": args.max_length,
                "class_weights": bool(args.class_weights),
                "seed": args.seed,
            },
            "best_validation": {
                "accuracy": round(float(val["eval_accuracy"]), 4),
                "f1_macro": round(float(val["eval_f1_macro"]), 4),
            },
            "log_history": trainer.state.log_history,
        },
    )
    print("\n  Next: python ml/evaluate.py   (scores the untouched test split)")


if __name__ == "__main__":
    main()
