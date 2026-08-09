# Deployment runbook

Live environments, how they were provisioned, and how to operate them.

## Current deployments

| Component | Host | URL |
|---|---|---|
| Frontend | Vercel (`tricore1/emotionsense`) | https://emotionsense-ochre.vercel.app |
| Backend | Render (`srv-d9sdgs67bikc739c2egg`) | https://emotionsense-api-452m.onrender.com |
| Source | GitHub | https://github.com/claudeproject751-dot/tricore |
| Model | Hugging Face Hub | set via `MODEL_REPO` |

Vercel also serves these aliases for the same production deployment:
`emotionsense-tricore1.vercel.app`, `emotionsense-claudeproject751-6243-tricore1.vercel.app`.

---

## Credential hygiene

Every token used during setup was pasted into a chat transcript and must be
treated as compromised. **Rotate all of them:**

| Token | Rotate at |
|---|---|
| Hugging Face | https://huggingface.co/settings/tokens |
| Vercel | https://vercel.com/account/tokens |
| Render | https://dashboard.render.com/u/settings#api-keys |
| GitHub PAT | https://github.com/settings/tokens |

Local secrets live in git-ignored files and are never committed:

```
ml/.env                 HF_TOKEN, MODEL_REPO
backend/.env            MODEL_REPO, ALLOWED_ORIGIN, ...
frontend/.env.local     NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL
.env.deploy.local       VERCEL_TOKEN, RENDER_API_KEY
```

Verify before any push:

```bash
git status --short | grep -iE '\.env$|\.env\.[^e]' || echo "clean"
```

---

## Backend — Render

Provisioned as a Docker web service on the free plan, root directory `backend`,
health check `/api/health`, auto-deploy on push to `main`.

`backend/render.yaml` is a Blueprint for reproducing this from scratch:
Render → **New → Blueprint** → select the repo.

### Environment variables

| key | value | notes |
|---|---|---|
| `MODEL_REPO` | `<user>/emotion-distilbert` | swap to your own once trained |
| `ALLOWED_ORIGIN` | comma-separated origins | must include the Vercel domain |
| `RATE_LIMIT` | `60/minute` | prediction routes only |
| `ENABLE_DOCS` | `true` | serves `/docs` |
| `HF_HOME` | `/app/model_cache` | keeps weights in the image layer |
| `HF_TOKEN` | *(unset)* | only needed for a private `MODEL_REPO` |

### Free-tier behaviour

The instance sleeps after ~15 minutes idle. The next request takes **30–60s**
while the container wakes. This is handled deliberately, not hidden:

- The model loads on a background thread, so `/api/health` answers immediately
  with `status: "loading"`.
- Prediction requests during that window return `503` with
  `code: "model_loading"` and a `Retry-After` header.
- The frontend renders a "waking up the model" state, and the header status dot
  polls every 6s while waking (60s once healthy).

Weights are baked into the image at build time, so a cold start is container
boot only — not a fresh 250MB download.

### Operations

```bash
export RK=<render-api-key>
SRV=srv-d9sdgs67bikc739c2egg

# Deploy status
curl -s -H "Authorization: Bearer $RK" \
  "https://api.render.com/v1/services/$SRV/deploys?limit=5" \
  | python -m json.tool

# Trigger a deploy
curl -s -X POST -H "Authorization: Bearer $RK" \
  "https://api.render.com/v1/services/$SRV/deploys"

# Update an env var (triggers a redeploy)
curl -s -X PUT -H "Authorization: Bearer $RK" -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SRV/env-vars/MODEL_REPO" \
  -d '{"value":"yourname/emotion-distilbert"}'
```

### Alternative host: Hugging Face Spaces

`backend/Dockerfile` also works as a Docker SDK Space, which is attractive
because it is co-located with the model and doesn't sleep on idle. Two changes
are required:

1. Add a `README.md` with Spaces frontmatter (`sdk: docker`, `app_port: 7860`).
2. Set `ENV PORT=7860` and use uid `1000` for the runtime user.

**This was attempted and is currently blocked:** Docker Spaces on free
`cpu-basic` now require a PRO subscription (`402 Payment Required` from
`POST /api/repos/create`). Static Spaces remain free. Render was used instead.

### First deploy is slow

The Docker build installs torch and pre-downloads the model. Expect **10–20
minutes** on the free plan. Subsequent deploys reuse layer cache and are faster.

---

## Frontend — Vercel

Project `tricore1/emotionsense`, framework preset Next.js, root directory
`frontend`.

### Environment variables (Production)

| key | value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://emotionsense-api-452m.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://emotionsense-ochre.vercel.app` |

Both are `NEXT_PUBLIC_*`, so they are **inlined at build time**. Changing either
requires a redeploy — editing the variable alone does nothing to the live site.

```bash
export VT=<vercel-token>
cd frontend

npx vercel env ls production --token "$VT" --scope tricore1
npx vercel deploy --prod --yes --token "$VT" --scope tricore1
```

### Connecting the GitHub repo (recommended)

The current deployment was pushed from the CLI. To get push-to-deploy and PR
previews, connect the repo in the Vercel dashboard:

**Project → Settings → Git → Connect Git Repository** → `claudeproject751-dot/tricore`,
root directory `frontend`.

---

## Swapping in your own trained model

1. Train via `ml/notebooks/emotionsense_train_kaggle.ipynb` and push to the Hub.
2. Copy the notebook's `metrics.json`, `baseline_metrics.json`,
   `class_distribution.json` and PNGs into `ml/artifacts/`.
3. Update Render's `MODEL_REPO` to your repo id (triggers a redeploy).
4. Commit the artifacts and push — the About page and README numbers update
   themselves from `metrics.json`.

Never commit `ml/artifacts/emotion-distilbert/` or `checkpoints/`. Weights live
on the Hub; the repo keeps only the numbers.

---

## Post-deploy smoke test

```bash
API=https://emotionsense-api-452m.onrender.com
SITE=https://emotionsense-ochre.vercel.app

curl -s "$API/api/health" | python -m json.tool
curl -s -X POST "$API/api/predict" -H "Content-Type: application/json" \
  -d '{"text":"i cant stop smiling this is the best news all year"}' | python -m json.tool

for p in / /analyze /batch /about; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "$SITE$p")"
done
```

Then, in a fresh incognito window:

- [ ] Hero demo autoplays and returns a prediction
- [ ] Typing in the hero takes over from autoplay
- [ ] `/analyze` updates ~400ms after you stop typing
- [ ] History rail persists across a refresh
- [ ] `/batch` accepts pasted lines and exports CSV
- [ ] `/about` shows real metrics, not placeholders
- [ ] Light/dark toggle looks deliberate in both modes
- [ ] API status dot in the header reflects real backend state
- [ ] Mobile viewport (375px) has no horizontal scroll

---

## Troubleshooting

**Frontend loads but every prediction fails.** Check `ALLOWED_ORIGIN` on Render
includes the exact Vercel domain including scheme. CORS failures surface in the
UI as the offline state.

**Predictions return 503 forever.** `GET /api/health` reports `model_source`. If
it stays `none`, the transformer failed to load — check Render logs for the
error captured in `EmotionClassifier.error`. If it reads `baseline`, the API is
degraded but serving; `MODEL_REPO` is likely wrong.

**About page shows "—" for metrics.** No `ml/artifacts/metrics.json` in the
build, and `GET /api/model` returned none either. Expected until you train.

**Changed an env var but the site is unchanged.** `NEXT_PUBLIC_*` values are
build-time. Redeploy.
