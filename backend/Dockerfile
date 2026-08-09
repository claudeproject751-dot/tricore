# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    # Keep the HF cache inside the image layer so a restarted container does not
    # re-download the weights.
    HF_HOME=/app/model_cache \
    PORT=8000

WORKDIR /app

# curl is used by the container HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# CPU-only torch: ~200MB instead of the ~2.5GB CUDA build, which matters a lot
# on a free-tier image size limit.
RUN pip install --no-cache-dir torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Bake the weights into the image so the first request after a cold start is not
# also the first download. Build with --build-arg MODEL_REPO=you/emotion-distilbert.
ARG MODEL_REPO=bhadresh-savani/distilbert-base-uncased-emotion
ENV MODEL_REPO=${MODEL_REPO}
RUN python -c "\
from transformers import AutoTokenizer, AutoModelForSequenceClassification; \
import os; r = os.environ['MODEL_REPO']; \
AutoTokenizer.from_pretrained(r); AutoModelForSequenceClassification.from_pretrained(r); \
print('cached', r)"

RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/api/health || exit 1

# One worker: the model occupies ~300MB of RAM and free tiers cap at 512MB.
# Concurrency comes from the threadpool inference path, not from extra processes.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 65"]
