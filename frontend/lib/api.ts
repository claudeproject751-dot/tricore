/**
 * Typed client for the EmotionSense API.
 *
 * Every failure mode the UI has to render is represented as a discriminated
 * `ApiErrorKind`, so call sites branch on a kind rather than on string matching:
 *
 *   offline   — no network at all
 *   waking    — backend is up but the model is still loading (free-tier cold start)
 *   timeout   — request exceeded the deadline
 *   validation— the API rejected the input (422)
 *   rate_limit— too many requests (429)
 *   server    — 5xx
 *   unknown   — anything else
 */

export type EmotionScore = { label: string; score: number };

export type PredictResponse = {
  text: string;
  label: string;
  emoji: string;
  confidence: number;
  predictions: EmotionScore[];
  latency_ms: number;
  model_source: string;
};

export type AggregateBucket = {
  label: string;
  count: number;
  share: number;
  mean_confidence: number;
};

export type BatchPredictResponse = {
  results: PredictResponse[];
  aggregate: AggregateBucket[];
  dominant: string;
  count: number;
  latency_ms: number;
  model_source: string;
};

export type HealthResponse = {
  status: "ok" | "loading" | "degraded";
  model: string;
  model_source: string;
  version: string;
  labels: string[];
  uptime_seconds: number;
  warm: boolean;
};

export type ModelMetrics = {
  model: { base: string; architecture: string; num_labels: number; parameters: number };
  dataset: {
    id: string;
    config: string;
    splits: Record<string, number>;
    license_note: string;
    citation: string;
  };
  evaluation: {
    split: string;
    n: number;
    accuracy: number;
    f1_macro: number;
    f1_weighted: number;
  };
  per_class: Record<
    string,
    { precision: number; recall: number; f1: number; support: number }
  >;
  confusion_matrix?: { labels: string[]; counts: number[][] };
  baseline_comparison: { accuracy: number; f1_macro: number } | null;
  throughput?: {
    device: string;
    hardware: string;
    batch_size: number;
    total_seconds: number;
    ms_per_sample: number;
  };
};

export type ModelInfoResponse = {
  model: string;
  model_source: string;
  labels: string[];
  metrics: ModelMetrics | null;
};

export type ApiErrorKind =
  | "offline"
  | "waking"
  | "timeout"
  | "validation"
  | "rate_limit"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Whether a retry has a reasonable chance of succeeding. */
  readonly retryable: boolean;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryable = kind !== "validation";
  }
}

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/** A single prediction should never take this long once the model is warm. */
const DEFAULT_TIMEOUT_MS = 20_000;
/** Batches are legitimately slower. */
const BATCH_TIMEOUT_MS = 60_000;

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

function messageFor(kind: ApiErrorKind, fallback: string): string {
  switch (kind) {
    case "offline":
      return "Can't reach the analysis service. Check your connection and try again.";
    case "waking":
      return "The model is waking up. On the free tier this takes up to a minute after a quiet spell.";
    case "timeout":
      return "That took longer than expected. The service may be starting up — try once more.";
    case "rate_limit":
      return "Too many requests in a short window. Give it a few seconds.";
    case "server":
      return "The analysis service hit an error. This one is on us — try again shortly.";
    default:
      return fallback;
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);

  // Forward an externally supplied abort (debounce cancellation) into ours.
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init.headers },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail: string | undefined = body?.detail;

      if (res.status === 503 || body?.code === "model_loading") {
        throw new ApiError("waking", messageFor("waking", ""), res.status);
      }
      if (res.status === 422) {
        throw new ApiError("validation", detail ?? "That input isn't valid.", 422);
      }
      if (res.status === 429) {
        throw new ApiError("rate_limit", messageFor("rate_limit", ""), 429);
      }
      if (res.status >= 500) {
        throw new ApiError("server", messageFor("server", ""), res.status);
      }
      throw new ApiError("unknown", detail ?? `Request failed (${res.status})`, res.status);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    // A caller-initiated abort is not an error the UI should surface.
    if (signal?.aborted) throw err;

    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError("timeout", messageFor("timeout", ""));
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("timeout", messageFor("timeout", ""));
    }
    throw new ApiError("offline", messageFor("offline", ""));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function predict(text: string, opts?: RequestOptions): Promise<PredictResponse> {
  return request<PredictResponse>(
    "/api/predict",
    { method: "POST", body: JSON.stringify({ text }) },
    opts,
  );
}

export function predictBatch(
  texts: string[],
  opts?: RequestOptions,
): Promise<BatchPredictResponse> {
  return request<BatchPredictResponse>(
    "/api/predict/batch",
    { method: "POST", body: JSON.stringify({ texts }) },
    { timeoutMs: BATCH_TIMEOUT_MS, ...opts },
  );
}

export function health(opts?: RequestOptions): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", { method: "GET" }, { timeoutMs: 8_000, ...opts });
}

export function modelInfo(opts?: RequestOptions): Promise<ModelInfoResponse> {
  return request<ModelInfoResponse>("/api/model", { method: "GET" }, { timeoutMs: 10_000, ...opts });
}
