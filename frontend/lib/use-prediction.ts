"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, predict, type PredictResponse } from "./api";

export type PredictionPhase = "idle" | "typing" | "analyzing" | "waking" | "ready" | "error";

export type PredictionState = {
  result: PredictResponse | null;
  phase: PredictionPhase;
  error: ApiError | null;
  /** True only for the very first request of a session, which may hit a cold backend. */
  firstRequest: boolean;
};

/**
 * Debounced live analysis.
 *
 * Behaviours that matter for feel:
 * - The previous result stays on screen while a new one is in flight, so the
 *   charts morph instead of collapsing to empty.
 * - In-flight requests are aborted when the text changes again; a stale response
 *   can never overwrite a newer one.
 * - The first request of a session gets a longer grace period and a distinct
 *   "waking" phase, because a free-tier backend can take ~45s to cold start.
 */
export function usePrediction({
  text,
  enabled = true,
  debounceMs = 400,
  minLength = 3,
}: {
  text: string;
  enabled?: boolean;
  debounceMs?: number;
  minLength?: number;
}): PredictionState & { retry: () => void; reset: () => void } {
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [phase, setPhase] = useState<PredictionPhase>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [firstRequest, setFirstRequest] = useState(true);
  const [nonce, setNonce] = useState(0);

  const controllerRef = useRef<AbortController | null>(null);
  const wakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow response for text the user has since changed.
  const latestTextRef = useRef(text);

  const run = useCallback(
    async (value: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setPhase("analyzing");
      setError(null);

      // If nothing has come back after 2.5s, this is almost certainly a cold
      // start rather than a slow model — say so instead of spinning silently.
      wakingTimerRef.current = setTimeout(() => {
        if (!controller.signal.aborted) setPhase("waking");
      }, 2500);

      try {
        const response = await predict(value, { signal: controller.signal });
        if (controller.signal.aborted || latestTextRef.current !== value) return;
        setResult(response);
        setPhase("ready");
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError("unknown", "Something went wrong."));
        setPhase("error");
      } finally {
        if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
        setFirstRequest(false);
      }
    },
    [],
  );

  useEffect(() => {
    latestTextRef.current = text;
    const trimmed = text.trim();

    if (!enabled) return;

    if (trimmed.length < minLength) {
      controllerRef.current?.abort();
      setPhase("idle");
      setError(null);
      setResult(null);
      return;
    }

    setPhase((current) => (current === "ready" || current === "error" ? "typing" : current));

    const timer = setTimeout(() => void run(trimmed), debounceMs);
    return () => clearTimeout(timer);
  }, [text, enabled, minLength, debounceMs, run, nonce]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
    },
    [],
  );

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setResult(null);
    setError(null);
    setPhase("idle");
  }, []);

  return { result, phase, error, firstRequest, retry, reset };
}
