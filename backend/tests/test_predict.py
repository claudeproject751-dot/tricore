"""Contract tests for the prediction endpoints."""

from __future__ import annotations

import pytest

from app.config import get_settings

settings = get_settings()


# ------------------------------------------------------------------ happy path


def test_predict_happy_path(client, all_labels):
    res = client.post("/api/predict", json={"text": "i am so excited about this"})
    assert res.status_code == 200

    body = res.json()
    assert body["label"] in all_labels
    assert body["label"] == "joy"
    assert body["emoji"]
    assert 0.0 <= body["confidence"] <= 1.0
    assert body["latency_ms"] >= 0
    assert body["model_source"] == "transformer"
    assert body["text"] == "i am so excited about this"


def test_predict_returns_all_six_classes_descending(client, all_labels):
    body = client.post("/api/predict", json={"text": "i feel great"}).json()
    preds = body["predictions"]

    assert len(preds) == len(all_labels)
    assert {p["label"] for p in preds} == set(all_labels)
    assert preds == sorted(preds, key=lambda p: -p["score"])
    assert preds[0]["label"] == body["label"]
    assert sum(p["score"] for p in preds) == pytest.approx(1.0, abs=1e-3)


def test_predict_trims_whitespace(client):
    body = client.post("/api/predict", json={"text": "  i feel happy  "}).json()
    assert body["text"] == "i feel happy"


def test_predict_sets_timing_header(client):
    res = client.post("/api/predict", json={"text": "i feel happy"})
    assert float(res.headers["X-Process-Time-Ms"]) >= 0


# ------------------------------------------------------------------ validation


def test_predict_rejects_empty_text(client):
    res = client.post("/api/predict", json={"text": ""})
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"


def test_predict_rejects_whitespace_only_text(client):
    res = client.post("/api/predict", json={"text": "     "})
    assert res.status_code == 422


def test_predict_rejects_oversized_text(client):
    res = client.post("/api/predict", json={"text": "a" * (settings.max_text_length + 1)})
    assert res.status_code == 422
    assert "detail" in res.json()


def test_predict_accepts_text_at_the_limit(client):
    res = client.post("/api/predict", json={"text": "a" * settings.max_text_length})
    assert res.status_code == 200


def test_predict_rejects_missing_field(client):
    assert client.post("/api/predict", json={}).status_code == 422


def test_predict_rejects_wrong_type(client):
    assert client.post("/api/predict", json={"text": 42}).status_code == 422


def test_validation_error_message_is_human_readable(client):
    detail = client.post("/api/predict", json={"text": ""}).json()["detail"]
    assert detail.startswith("text:")
    assert "Value error" not in detail


# ----------------------------------------------------------------- cold start


def test_predict_returns_503_while_model_loads(loading_client):
    res = loading_client.post("/api/predict", json={"text": "i feel happy"})
    assert res.status_code == 503
    body = res.json()
    assert body["code"] == "model_loading"
    assert "waking up" in body["detail"]
    assert res.headers["Retry-After"] == "10"


def test_health_reports_loading_state(loading_client):
    body = loading_client.get("/api/health").json()
    assert body["status"] == "loading"
    assert body["warm"] is False


# ---------------------------------------------------------------------- batch


def test_batch_happy_path(client, all_labels):
    texts = ["i am so happy", "i am furious", "i feel scared", "i am happy again"]
    res = client.post("/api/predict/batch", json={"texts": texts})
    assert res.status_code == 200

    body = res.json()
    assert body["count"] == len(texts)
    assert len(body["results"]) == len(texts)
    assert [r["text"] for r in body["results"]] == texts
    assert body["dominant"] in all_labels


def test_batch_aggregate_is_consistent(client):
    texts = ["i am so happy", "i am happy too", "i am furious"]
    body = client.post("/api/predict/batch", json={"texts": texts}).json()

    agg = body["aggregate"]
    assert sum(b["count"] for b in agg) == len(texts)
    assert sum(b["share"] for b in agg) == pytest.approx(1.0, abs=1e-6)
    assert agg == sorted(agg, key=lambda b: (-b["count"], b["label"]))
    assert body["dominant"] == agg[0]["label"]
    assert agg[0]["label"] == "joy"


def test_batch_drops_blank_lines(client):
    body = client.post("/api/predict/batch", json={"texts": ["i am happy", "  ", ""]}).json()
    assert body["count"] == 1


def test_batch_rejects_empty_list(client):
    assert client.post("/api/predict/batch", json={"texts": []}).status_code == 422


def test_batch_rejects_all_blank(client):
    assert client.post("/api/predict/batch", json={"texts": ["", "   "]}).status_code == 422


def test_batch_rejects_oversized_list(client):
    texts = ["i feel happy"] * (settings.max_batch_size + 1)
    assert client.post("/api/predict/batch", json={"texts": texts}).status_code == 422


def test_batch_rejects_oversized_item(client):
    long = "a" * (settings.max_text_length + 1)
    res = client.post("/api/predict/batch", json={"texts": ["ok", long]})
    assert res.status_code == 422


def test_batch_is_a_single_model_call(client, stub):
    """Batching must not degenerate into N sequential single predictions."""
    client.post("/api/predict/batch", json={"texts": ["a happy one", "an angry one"]})
    assert len(stub.calls) == 1
    assert len(stub.calls[0]) == 2


def test_batch_at_the_size_limit(client):
    texts = ["i feel happy"] * settings.max_batch_size
    res = client.post("/api/predict/batch", json={"texts": texts})
    assert res.status_code == 200
    assert res.json()["count"] == settings.max_batch_size


# ----------------------------------------------------------------- meta routes


def test_health_ok(client, all_labels):
    res = client.get("/api/health")
    assert res.status_code == 200

    body = res.json()
    assert body["status"] == "ok"
    assert body["model"]
    assert body["version"]
    assert body["labels"] == list(all_labels)
    assert body["uptime_seconds"] >= 0


def test_health_becomes_warm_after_a_prediction(client):
    assert client.get("/api/health").json()["warm"] is False
    client.post("/api/predict", json={"text": "i feel happy"})
    assert client.get("/api/health").json()["warm"] is True


def test_model_info_exposes_labels(client, all_labels):
    body = client.get("/api/model").json()
    assert body["labels"] == list(all_labels)
    assert "metrics" in body


def test_openapi_docs_are_reachable(client):
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    assert "/api/predict" in schema["paths"]
    assert "/api/predict/batch" in schema["paths"]


def test_root_redirects_to_docs(client):
    res = client.get("/", follow_redirects=False)
    assert res.status_code in (307, 200)


def test_cors_preflight_allows_configured_origin(client):
    origin = settings.cors_origins[0]
    res = client.options(
        "/api/predict",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == origin


def test_cors_blocks_unknown_origin(client):
    res = client.options(
        "/api/predict",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in res.headers
