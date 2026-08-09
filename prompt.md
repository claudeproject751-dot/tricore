# EmotionSense — Full-Stack Emotion Intelligence Platform
### Master build prompt for Claude Code

You are an expert full-stack engineer + ML engineer + product designer. Build a **production-grade, portfolio-flagship** web application called **EmotionSense**: a real-time text emotion classifier trained on the `dair-ai/emotion` dataset, served through a fast API, and presented through a frontend that looks and feels like a funded, category-defining SaaS product (think Linear, Vercel, Stripe, Superhuman — not a student project).

Work through the phases below **in order**. After each phase, run the relevant tests/build, report status, and only continue when the phase is green. Commit after each phase with a clear message. Do not skip the design polish — it is a first-class requirement, not a nice-to-have.

---

## 1. Product Overview

**What it does:** a user types or pastes text and instantly sees which of 6 emotions it expresses — sadness, joy, love, anger, fear, surprise — with a confidence breakdown across all classes, presented with rich, animated, data-driven visuals. Includes a live "type and watch it think" demo on the landing page, a full analyzer workspace, session history, and a batch-analysis mode (paste multiple lines / upload a CSV of sentences → get a distribution report).

**Why it should feel expensive:**
- Considered typography, a real color system (not default Tailwind), generous whitespace, motion with purpose (not decoration), dark-mode-first with a light mode that's equally polished.
- Every interaction has a state: loading, empty, error, success — all designed, none left default.
- Fast: skeleton states, optimistic UI, debounced calls, streaming-feel transitions.

**Dataset:** [`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion) — English tweets labeled with 6 basic emotions (Saravia et al., CARER, EMNLP 2018). Use the `split` config:

| split | rows |
|---|---|
| train | 16,000 |
| validation | 2,000 |
| test | 2,000 |

Labels: `0 sadness`, `1 joy`, `2 love`, `3 anger`, `4 fear`, `5 surprise`.
License note: dataset card states research/educational use — display this in the app footer/about page.

---

## 2. Architecture

```
                     ┌─────────────────────────┐
   User ───────────▶ │   Frontend (Next.js)    │
                     │   hosted on Vercel      │
                     └───────────┬─────────────┘
                                 │ HTTPS / JSON (fetch)
                                 ▼
                     ┌─────────────────────────┐
                     │   Backend (FastAPI)      │
                     │   hosted on Render        │
                     │   (or HF Spaces Docker)   │
                     └───────────┬─────────────┘
                                 │ loads at boot
                                 ▼
                     ┌─────────────────────────┐
                     │  Fine-tuned DistilBERT   │
                     │  hosted on HF Hub Model  │
                     │  Repo (yourname/emotion- │
                     │  distilbert)             │
                     └─────────────────────────┘
```

Training happens **once, offline** (Colab / local GPU / HF AutoTrain) — the trained model is pushed to the Hugging Face Hub. The backend downloads it at container boot (or bundles it) and serves inference. The frontend never talks to HF directly; it only talks to your FastAPI backend.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| ML training | Python, `transformers`, `datasets`, `scikit-learn`, PyTorch | Standard, well-documented, HF-native |
| Model | `distilbert-base-uncased` fine-tuned, 6-way classification head | Small, fast, ~94% accuracy achievable on this dataset, cheap to serve |
| Model hosting | Hugging Face Hub (model repo) | Free, versioned, easy `from_pretrained()` |
| Backend | FastAPI + Uvicorn/Gunicorn, Python 3.11 | Async, typed, auto OpenAPI docs, fast |
| Backend hosting | Render (Docker Web Service) — alt: HF Spaces (Docker SDK) | Free/low-cost, simple git-push deploys |
| Frontend | Next.js 14 (App Router) + TypeScript | SSR/edge-ready, best Vercel integration |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | Fast, accessible, fully themeable |
| Motion | Framer Motion | Purposeful micro-interactions |
| Charts | Recharts (radar + bar) | Lightweight, composable |
| Fonts | `Geist` (or `General Sans`) for display, `Inter` for body, `Geist Mono` for numbers/code | Premium, neutral, highly legible |
| Frontend hosting | Vercel | Zero-config Next.js deploys, previews per PR |
| State | React Server Components + minimal client state (Zustand for history) | Simplicity |

---

## 4. Repository Structure

```
emotionsense/
├── ml/
│   ├── data_prep.py
│   ├── train_baseline.py        # TF-IDF + LogisticRegression sanity check
│   ├── train_transformer.py     # DistilBERT fine-tune (main model)
│   ├── evaluate.py
│   ├── push_to_hub.py
│   ├── requirements.txt
│   └── artifacts/               # confusion matrix, metrics.json, plots
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── model.py             # model load + inference wrapper
│   │   ├── config.py
│   │   └── routers/
│   │       ├── predict.py
│   │       └── health.py
│   ├── tests/
│   │   └── test_predict.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── render.yaml
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # landing
│   │   ├── analyze/page.tsx      # main workspace
│   │   ├── batch/page.tsx        # batch/CSV mode
│   │   ├── about/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── hero-live-demo.tsx
│   │   ├── emotion-radar.tsx
│   │   ├── confidence-bars.tsx
│   │   ├── history-panel.tsx
│   │   └── gradient-mesh-bg.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── emotion-theme.ts      # color/emoji/copy map per emotion
│   ├── tailwind.config.ts
│   ├── vercel.json
│   └── package.json
├── .github/workflows/ci.yml
└── README.md
```

---

## 5. Phase 0 — Project Setup

1. Initialize a git repo `emotionsense/` with the structure above.
2. Create three isolated environments: `ml/.venv`, `backend/.venv`, and the frontend's `node_modules` (Next.js).
3. Create a Hugging Face account/token and a Vercel account if not already set up; keep tokens in `.env` files that are git-ignored. Add `.env.example` files documenting every variable (see §11).
4. Set up `.github/workflows/ci.yml` to lint + test backend (pytest) and frontend (`npm run build`, `npm run lint`) on every push.

---

## 6. Phase 1 — ML Training (`ml/`)

### 6.1 Data prep (`data_prep.py`)
- Load via `datasets.load_dataset("dair-ai/emotion", "split")`.
- Inspect class balance (it's imbalanced — `joy` and `sadness` dominate; `surprise` is rare). Log the distribution to `artifacts/class_distribution.json` and render a bar chart.
- No heavy cleaning needed (text is already lowercased, no punctuation) — just strip whitespace.

### 6.2 Baseline (`train_baseline.py`)
Quick sanity-check model before the expensive one:
- `TfidfVectorizer(ngram_range=(1,2), max_features=20000)` → `LogisticRegression(max_iter=1000, class_weight="balanced")`.
- Report accuracy + macro-F1 on the validation set. This should land ~87–89% accuracy — your target for the transformer is to clearly beat it.
- Save this model to `artifacts/baseline.joblib` — it's a useful fallback/ensemble signal but **not** what you ship.

### 6.3 Transformer fine-tune (`train_transformer.py`) — the model you ship
```python
from datasets import load_dataset
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, DataCollatorWithPadding,
)
import numpy as np
import evaluate

MODEL_NAME = "distilbert-base-uncased"
id2label = {0: "sadness", 1: "joy", 2: "love", 3: "anger", 4: "fear", 5: "surprise"}
label2id = {v: k for k, v in id2label.items()}

ds = load_dataset("dair-ai/emotion", "split")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, max_length=96)

ds_tok = ds.map(tokenize, batched=True)
collator = DataCollatorWithPadding(tokenizer=tokenizer)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, num_labels=6, id2label=id2label, label2id=label2id
)

accuracy = evaluate.load("accuracy")
f1 = evaluate.load("f1")

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy.compute(predictions=preds, references=labels)["accuracy"],
        "f1_macro": f1.compute(predictions=preds, references=labels, average="macro")["f1"],
    }

args = TrainingArguments(
    output_dir="artifacts/checkpoints",
    learning_rate=2e-5,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=64,
    num_train_epochs=5,
    weight_decay=0.01,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    logging_steps=50,
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=ds_tok["train"],
    eval_dataset=ds_tok["validation"],
    tokenizer=tokenizer,
    data_collator=collator,
    compute_metrics=compute_metrics,
)

trainer.train()
trainer.save_model("artifacts/emotion-distilbert")
tokenizer.save_pretrained("artifacts/emotion-distilbert")
```
Notes for the agent:
- `max_length=96` is enough (dataset texts are short tweets, ≤300 chars).
- Use `class_weight`-style handling only if the baseline shows the transformer is badly biased against `surprise`/`love` — usually fine-tuning alone handles it; if not, add a weighted loss via a custom `Trainer.compute_loss`.
- If a GPU is available use fp16 (`args.fp16 = True`); otherwise this still trains in a reasonable time on CPU for 16k rows.

### 6.4 Evaluation (`evaluate.py`)
- Run the saved model on the **test** split (never touched during training).
- Output: overall accuracy, macro-F1, per-class precision/recall/F1 (`classification_report`), and a confusion matrix heatmap saved to `artifacts/confusion_matrix.png`.
- Save all numbers to `artifacts/metrics.json` — the frontend "About/Model" section will cite these numbers, so they must be real, not invented.

### 6.5 Push to Hub (`push_to_hub.py`)
- `model.push_to_hub("yourusername/emotion-distilbert")`, same for tokenizer.
- Write a proper model card: intended use, dataset, metrics table pulled from `metrics.json`, limitations (Twitter-register English text, 6 fixed classes, not clinical/diagnostic).

**Definition of done for Phase 1:** `artifacts/metrics.json` exists with test-set macro-F1 ≥ baseline, model is live on the HF Hub and loadable via `pipeline("text-classification", model="yourusername/emotion-distilbert")`.

---

## 7. Phase 2 — Backend (`backend/`)

### 7.1 Inference wrapper (`app/model.py`)
- Load the pipeline once at module import (not per-request):
```python
from transformers import pipeline
classifier = pipeline(
    "text-classification",
    model="yourusername/emotion-distilbert",
    top_k=None,          # return all 6 class scores
    truncation=True,
)
```
- Wrap in a function `predict(text: str) -> list[dict]` returning `[{"label": "joy", "score": 0.93}, ...]` sorted descending.
- For latency: consider `optimum[onnxruntime]` export post-training to cut CPU inference time, especially important on Render's free tier. Document this as an optional Phase-1.5 step.

### 7.2 API (`app/main.py`, `routers/predict.py`)
Endpoints:
- `POST /api/predict` → body `{ "text": str }` → returns top label, emoji, full score distribution, latency_ms.
- `POST /api/predict/batch` → body `{ "texts": [str, ...] }` (cap at ~200 items) → array of results + aggregate distribution (for the batch/CSV mode).
- `GET /api/health` → `{ "status": "ok", "model": "...", "version": "..." }` — used by Render health checks and the frontend's "API status" indicator.
- Auto docs at `/docs` (FastAPI default) — keep enabled, it's a nice credibility signal.

Cross-cutting:
- Pydantic schemas for request/response (`schemas.py`), strict validation (min/max text length, reject empty).
- CORS: allow only the deployed Vercel domain(s) + `localhost:3000` in dev.
- Basic rate limiting (e.g. `slowapi`) — 60 req/min/IP — to protect the free-tier host from abuse.
- Structured logging of request text length + prediction + latency (never log full user text to a third party — this is your own log only).

### 7.3 Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV PORT=8000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 7.4 Deploy — Render (primary)
`render.yaml` (Blueprint, so it's one click from the repo):
```yaml
services:
  - type: web
    name: emotionsense-api
    env: docker
    plan: free
    healthCheckPath: /api/health
    envVars:
      - key: MODEL_REPO
        value: yourusername/emotion-distilbert
      - key: ALLOWED_ORIGIN
        value: https://emotionsense.vercel.app
```
- Connect the GitHub repo in Render, point it at `backend/`, deploy.
- Note the free-tier cold-start (~30–60s after idle) — surface this gracefully in the frontend (a "waking up the model…" state), don't let it look broken.

### 7.5 Deploy — HF Spaces (alternative/mirror)
- Same Dockerfile works as an HF Spaces Docker SDK space. Useful because it's co-located with the model and has no sleep-on-idle surprises for demo purposes. Document both; let the user pick one as primary and optionally run both for redundancy.

**Definition of done for Phase 2:** `curl -X POST .../api/predict -d '{"text":"I am so excited!"}'` returns a correct, fast (<1s warm) JSON response from the deployed URL, and `/docs` is publicly reachable.

---

## 8. Phase 3 — Frontend (`frontend/`)

This is where "billion-dollar feel" is won or lost. Be deliberate.

### 8.1 Design system
**Color:** dark-first. Background near-black with a subtle warm/cool gradient mesh (`#0A0A0F` → `#0F0F1A`), not flat black. One accent per emotion, used consistently everywhere (badges, chart colors, hover glows):

| Emotion | Color | Hex |
|---|---|---|
| Joy | warm amber | `#F5B942` |
| Sadness | cool blue | `#4A7FE0` |
| Love | rose | `#E85D8C` |
| Anger | red | `#E5484D` |
| Fear | violet | `#8B5CF6` |
| Surprise | teal | `#2DD4BF` |

Neutral text scale on near-black: `#FAFAFA` (headings), `#A1A1AA` (body), `#71717A` (muted). Light mode: mirror with `#FFFFFF`/`#F5F5F7` background and the same accent hues at slightly deeper saturation for contrast — do not just invert, redesign each mode.

**Typography:** `Geist` (or `General Sans`) for display/headings at large, confident sizes (clamp 2.5rem–5rem hero), `Inter` for body copy, `Geist Mono` for scores/percentages/timestamps (numbers in mono always look more "product-grade"). Tight tracking on large headings, generous line-height on body.

**Motion:** Framer Motion for: staggered fade/slide-in on scroll sections, a spring-based animated bar/radar chart that redraws on new predictions, a subtle glow that shifts hue to match the dominant detected emotion, page-level transitions. Motion should communicate *causality* (the UI reacts to the model, not decoration for its own sake).

**Texture/depth:** glassmorphic cards (`backdrop-blur-xl`, low-opacity borders, soft shadows), a faint grain/noise overlay on the hero for a "designed" feel, gradient mesh background component reused across pages.

### 8.2 Pages
- **`/` (Landing):** Hero headline + subhead, a *live inline demo* right in the hero (type a sentence, see the radar chart animate in real time, no navigation required — this is the single most important conversion element), logos/stats row ("94% accuracy · 16k labeled tweets · 6 emotions"), a "How it works" 3-step section, a model-card summary section pulling real numbers from your `metrics.json`, footer with dataset citation and license note.
- **`/analyze` (Workspace):** Large textarea, debounced live analysis (400ms), animated confidence bars + radar chart side by side, dominant-emotion hero card with color-matched glow, a session history rail (Zustand + localStorage) of past inputs/results, copy-result and share buttons.
- **`/batch`:** Paste multiple lines or upload a `.csv` (one text per row) → table of results + an aggregate distribution donut/bar chart + CSV export of results.
- **`/about`:** the story, the dataset, the metrics, the stack, links to GitHub/API docs.

### 8.3 API client (`lib/api.ts`)
```ts
export type EmotionScore = { label: string; score: number };
export type PredictResponse = { predictions: EmotionScore[]; latency_ms: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function predict(text: string): Promise<PredictResponse> {
  const res = await fetch(`${API_URL}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Prediction failed (${res.status})`);
  return res.json();
}
```
Every call site handles: loading (skeleton, not spinner), error (inline, human-readable, retry button), and the Render cold-start case (if the first call is slow, show "waking up the model — this can take up to a minute on the free tier" rather than a blank screen).

### 8.4 Deploy — Vercel
- `vercel.json` minimal (Next.js needs almost nothing); set `NEXT_PUBLIC_API_URL` in the Vercel project's environment variables to the deployed Render/HF URL.
- Connect GitHub repo → every push to `main` deploys to production, every PR gets a preview URL.
- Add a custom OG image, favicon, `metadata` export for SEO, and `sitemap.ts`/`robots.ts`.

**Definition of done for Phase 3:** Lighthouse scores ≥95 performance / ≥95 accessibility on the landing page, the live hero demo works end-to-end against the deployed backend, both dark and light mode are fully polished (no unstyled/default-looking element anywhere).

---

## 9. Phase 4 — Integration & Polish Pass

Go through the whole app once, end to end, and fix:
- Every loading/empty/error state actually designed, not a bare spinner or `undefined`.
- Mobile: hero demo, radar chart, and history rail all need real mobile layouts, not just squeezed desktop ones.
- Keyboard nav + screen reader labels on the analyzer (it's a form — treat it like one).
- Copy pass: every microcopy string reads like a real product ("Analyzing tone…" not "Loading...").
- Real metrics from `metrics.json` wired into the About page — never hardcode fabricated numbers.

---

## 10. Phase 5 — Testing

- **Backend:** `pytest` covering `/api/predict` happy path, empty text (422), oversized text (422), `/api/health`. Add these to CI.
- **Frontend:** a handful of component tests (React Testing Library) for the analyzer form and the API client's error handling; `npm run build` must pass in CI as the main regression gate.
- **Manual:** run the full 6 emotions through the live demo with obviously-representative sentences and confirm the top label matches expectation each time.

---

## 11. Environment Variables

| Var | Where | Example |
|---|---|---|
| `MODEL_REPO` | backend | `yourusername/emotion-distilbert` |
| `ALLOWED_ORIGIN` | backend | `https://emotionsense.vercel.app` |
| `HF_TOKEN` | ml (push only) | `hf_xxx` (never commit) |
| `NEXT_PUBLIC_API_URL` | frontend | `https://emotionsense-api.onrender.com` |

---

## 12. Phase 6 — Deployment Checklist

1. `ml/`: training complete, model pushed to HF Hub, `metrics.json` committed to repo (not the raw checkpoints — those stay on the Hub).
2. `backend/`: deployed on Render via `render.yaml`, `/api/health` green, CORS locked to the real Vercel domain.
3. `frontend/`: deployed on Vercel, `NEXT_PUBLIC_API_URL` pointed at the live backend, custom domain optional.
4. Update `README.md` at repo root with architecture diagram, live links, local dev instructions, and the real accuracy/F1 numbers.
5. Smoke test the whole flow from a fresh incognito window before calling it done.

---

## 13. Stretch Goals (only after everything above is solid)

- Multi-language support (translate → classify, or a multilingual model).
- Streaming token-by-token "typing" prediction updates instead of debounce-only.
- A tiny public API key system so others can hit `/api/predict` without hammering your free tier.
- An emotion-over-time chart for a pasted journal/chat log (batch mode + a timeline x-axis if timestamps are provided).
- Ensemble the baseline + transformer scores for a small accuracy bump and show both models' agreement as a "confidence" signal in the UI.

---

### How to use this file with Claude Code

```
claude
> Read prompt.md in full. Execute Phase 0 through Phase 6 in order.
> After each phase, run its tests/build, report the result, and wait
> for my go-ahead before starting the next phase. Do not skip the
> frontend design-polish requirements in Phase 3/4 — they are as
> important as the functionality.
```
