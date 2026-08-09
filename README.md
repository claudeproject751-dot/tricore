<div align="center">

# 🎭 EmotionSense

**Real-time emotion intelligence for text.**

Type a sentence, get a probability across six emotions — **sadness, joy, love,
anger, fear, surprise** — with the full distribution, not just the winner.

[**▶ Live app**](https://emotionsense-ochre.vercel.app) ·
[**API**](https://emotionsense-api-452m.onrender.com/api/health) ·
[**API docs**](https://emotionsense-api-452m.onrender.com/docs) ·
[**Training notebook**](ml/notebooks/emotionsense_train_kaggle.ipynb) ·
[**Deployment runbook**](DEPLOYMENT.md)

[![Live](https://img.shields.io/badge/demo-live-2DD4BF?style=flat-square)](https://emotionsense-ochre.vercel.app)
[![API](https://img.shields.io/badge/API-docs-8B5CF6?style=flat-square)](https://emotionsense-api-452m.onrender.com/docs)
[![CI](https://img.shields.io/github/actions/workflow/status/claudeproject751-dot/tricore/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/claudeproject751-dot/tricore/actions/workflows/ci.yml)
[![Accuracy](https://img.shields.io/badge/test%20accuracy-92.70%25-F5B942?style=flat-square)](#results)
[![Macro F1](https://img.shields.io/badge/macro%20F1-0.8825-E85D8C?style=flat-square)](#results)

[![Next.js](https://img.shields.io/badge/Next.js%2014-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org)
[![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97%20Transformers-FFD21E?style=flat-square)](https://huggingface.co/docs/transformers)
[![License](https://img.shields.io/badge/license-MIT-A1A1AA?style=flat-square)](#dataset--license)

</div>

A DistilBERT classifier fine-tuned on [`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion),
served by FastAPI, fronted by Next.js 14.

> [!NOTE]
> The API runs on Render's free tier and sleeps after ~15 minutes idle. The first
> request afterwards takes 30–60s. The UI shows a designed "waking up the model"
> state for exactly this reason rather than looking broken.

## What's inside

| | |
|---|---|
| 🎯 **Live analysis** | Debounced 400ms as you type — no submit button, no spinner |
| 📊 **Full distribution** | Animated radar + confidence bars across all six classes |
| 📁 **Batch mode** | Paste lines or drop a CSV → per-row table, aggregate chart, CSV export |
| 🕐 **Session history** | Local-only rail of past analyses, persisted across refresh |
| 🌗 **Dark & light** | Two independently designed palettes, not one inverted |
| 🧪 **58 tests** | 40 pytest + 18 Vitest, plus lint, typecheck and Docker build in CI |
| 📉 **Honest numbers** | Every metric read from `metrics.json`; nothing hardcoded |

---

## Architecture

```
                     ┌─────────────────────────┐
   User ───────────▶ │   Frontend (Next.js 14) │
                     │   Vercel                │
                     └───────────┬─────────────┘
                                 │ HTTPS / JSON
                                 ▼
                     ┌─────────────────────────┐
                     │   Backend (FastAPI)     │
                     │   Render · Docker       │
                     └───────────┬─────────────┘
                                 │ loads at boot
                                 ▼
                     ┌─────────────────────────┐
                     │  Fine-tuned DistilBERT  │
                     │  Hugging Face Hub       │
                     └─────────────────────────┘
```

Training happens **once, offline** (Kaggle GPU notebook). The trained model is
pushed to the Hub; the backend downloads it at container build/boot and serves
inference. The frontend only ever talks to the backend.

---

## Repository layout

```
.
├── ml/                          # training pipeline
│   ├── notebooks/
│   │   └── emotionsense_train_kaggle.ipynb   # ← primary training path (GPU)
│   ├── data_prep.py             # load, inspect class balance, plot
│   ├── train_baseline.py        # TF-IDF + LogisticRegression sanity check
│   ├── train_transformer.py     # DistilBERT fine-tune (CPU-capable fallback)
│   ├── evaluate.py              # test-split scoring → metrics.json
│   ├── push_to_hub.py           # upload model + generated model card
│   └── artifacts/               # metrics.json, plots, baseline.joblib
├── backend/                     # FastAPI inference service
│   ├── app/
│   │   ├── main.py              # app, CORS, middleware, error shaping
│   │   ├── model.py             # load + inference, with baseline fallback
│   │   ├── limiter.py           # per-route rate limiting
│   │   ├── schemas.py           # Pydantic request/response contracts
│   │   └── routers/{predict,health}.py
│   ├── tests/                   # pytest, stubbed model (no downloads in CI)
│   ├── Dockerfile
│   └── render.yaml              # Render Blueprint
├── frontend/                    # Next.js 14 App Router
│   ├── app/{page,analyze,batch,about}
│   ├── components/              # design system + feature components
│   └── lib/{api,emotion-theme,store,metrics}.ts
└── .github/workflows/ci.yml
```

---

## Results

Trained and evaluated on the standard `split` config: 16,000 train / 2,000
validation / 2,000 test. The test split is never seen during training or
checkpoint selection.

| model | test accuracy | test macro-F1 |
|---|---|---|
| TF-IDF + LogisticRegression (baseline) | 87.15% | 0.8344 |
| DistilBERT (currently deployed) | **92.70%** | **0.8825** |

The transformer beats the baseline by **+0.048 macro-F1**. Both numbers are
measured, not quoted — reproduce them with:

```bash
python ml/train_baseline.py                                   # → baseline_metrics.json
python ml/evaluate.py --model-dir <local-dir-or-hub-repo-id>  # → metrics.json
```

### Per class (test split)

| label | precision | recall | F1 | support |
|---|---|---|---|---|
| sadness | 0.969 | 0.966 | 0.967 | 581 |
| joy | 0.949 | 0.942 | 0.946 | 695 |
| love | 0.804 | 0.849 | 0.826 | 159 |
| anger | 0.927 | 0.920 | 0.923 | 275 |
| fear | 0.876 | 0.915 | 0.895 | 224 |
| surprise | 0.804 | **0.682** | 0.738 | 66 |

`surprise` recall of 0.68 against 0.97 for `sadness` is the class imbalance
showing up exactly where you'd expect it — 66 test examples versus 581. This is
why the aggregate accuracy number alone is misleading, and why checkpoints are
selected on macro-F1.

> **Nothing in the UI hardcodes a metric.** The About page reads
> `ml/artifacts/metrics.json`, falling back to the backend's `GET /api/model`.
> If the model hasn't been evaluated, the page says so rather than showing an
> invented number.

### Class imbalance

`joy` is ~33.5% of training data; `surprise` is ~3.6% — a 9.4× spread. Checkpoints
are therefore selected on **macro-F1**, not accuracy: a model that ignored
`surprise` entirely would still look fine on accuracy alone.

---

## Training the model

### Recommended: Kaggle (free T4, ~6 minutes)

1. Upload `ml/notebooks/emotionsense_train_kaggle.ipynb` to Kaggle.
2. **Settings → Accelerator → GPU T4 x2**, **Internet → On**.
3. **Add-ons → Secrets →** add `HF_TOKEN` (write scope).
4. Edit the config cell: set `HF_REPO = "yourname/emotion-distilbert"`.
5. Run all. It trains, evaluates on the test split, runs a 6-emotion sanity
   probe, generates a model card from the real metrics, and pushes to the Hub.
6. Download `metrics.json`, `baseline_metrics.json`, `class_distribution.json`
   and the PNGs from the Output tab into `ml/artifacts/`.

### Alternative: locally

```bash
python -m venv ml/.venv && ml/.venv/Scripts/activate    # or bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r ml/requirements.txt

python ml/data_prep.py          # class distribution + plots
python ml/train_baseline.py     # ~15s, sets the bar to beat
python ml/train_transformer.py  # ~45 min on CPU, ~5 min on GPU
python ml/evaluate.py           # → artifacts/metrics.json
python ml/push_to_hub.py --repo yourname/emotion-distilbert
```

---

## Local development

### Backend

```bash
python -m venv backend/.venv && backend/.venv/Scripts/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements.txt

cp backend/.env.example backend/.env      # set MODEL_REPO
cd backend && uvicorn app.main:app --reload --port 8000
```

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health

`MODEL_REPO` defaults to a public model trained on the same dataset and label
set, so the API is functional before you've published your own.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local                # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

http://localhost:3000

### Tests

```bash
cd backend  && pytest -q                  # 40 tests, model stubbed
cd frontend && npm test                   # 18 tests (Vitest + RTL)
cd frontend && npm run build              # the main regression gate

RUN_MODEL_TESTS=1 pytest backend/tests/test_model.py   # opt-in, downloads weights
```

---

## API

| method | path | purpose |
|---|---|---|
| `POST` | `/api/predict` | Score one text |
| `POST` | `/api/predict/batch` | Score ≤200 texts + aggregate distribution |
| `GET` | `/api/health` | Liveness + model readiness (Render health check) |
| `GET` | `/api/model` | Real evaluation metrics |
| `GET` | `/docs` | Interactive OpenAPI docs |

```bash
curl -X POST https://<your-api>/api/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"i cant stop smiling this is the best news all year"}'
```

```json
{
  "text": "i cant stop smiling this is the best news all year",
  "label": "joy",
  "emoji": "😊",
  "confidence": 0.998,
  "predictions": [{ "label": "joy", "score": 0.998 }, "…"],
  "latency_ms": 78.4,
  "model_source": "transformer"
}
```

### Behaviours worth knowing

- **Cold start is a first-class state.** The model loads on a background thread,
  so `/api/health` answers immediately with `status: "loading"`. Prediction
  requests return `503` + `code: "model_loading"` + `Retry-After`, and the
  frontend renders a "waking up the model" state instead of a blank screen.
- **Graceful degradation.** If the transformer can't load, the API falls back to
  the TF-IDF baseline and labels every response `model_source: "baseline"`.
  A degraded, honest API beats a 503.
- **Rate limited** to 60 req/min/IP on the prediction routes. Health and docs are
  never throttled, so status polling can't consume a visitor's budget.
- **User text is never persisted.** Logs record length, label and latency only.

---

## Deployment

Currently deployed at:

| component | host | URL |
|---|---|---|
| Frontend | Vercel | https://emotionsense-ochre.vercel.app |
| Backend | Render (Docker) | https://emotionsense-api-452m.onrender.com |
| API docs | Render | https://emotionsense-api-452m.onrender.com/docs |

Full provisioning steps, environment variables, cold-start behaviour, smoke
tests and troubleshooting live in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Backend → Render

The repo includes a Blueprint at `backend/render.yaml`.

1. Render → **New → Blueprint** → connect this repo.
2. Set `MODEL_REPO` to your Hub repo and `ALLOWED_ORIGIN` to your Vercel domain.
3. Deploy. Health check path is `/api/health`.

Free-tier instances sleep after ~15 minutes idle; the first request afterwards
takes 30–60s. The frontend handles this explicitly.

### Frontend → Vercel

1. Vercel → **Add New → Project** → import this repo, root directory `frontend`.
2. Environment variables:
   - `NEXT_PUBLIC_API_URL` → your Render URL
   - `NEXT_PUBLIC_SITE_URL` → your Vercel URL
3. Deploy. Every push to `main` ships; every PR gets a preview URL.

---

## Limitations

- **Register.** Trained on English tweets, most beginning "i feel…". Formal prose,
  long documents and other languages are out of distribution, and confidence
  there is poorly calibrated.
- **Fixed taxonomy.** Every input is forced into one of six classes. Neutral,
  mixed and sarcastic text has no correct answer available.
- **Rare classes.** `surprise` and `love` have measurably lower recall.
- **Not clinical.** Not a diagnostic instrument. Must not be used for
  mental-health screening, hiring, unreviewed moderation, or any decision
  affecting a person's rights or wellbeing.
- Inherits social biases from the source corpus and from DistilBERT's pretraining.

---

## Dataset & license

Dataset: [`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion) —
Saravia et al., *CARER: Contextualized Affect Representations for Emotion
Recognition*, EMNLP 2018. The dataset card states the data is for **research and
educational use**; this project is built and published on that basis.

Code is MIT licensed.
