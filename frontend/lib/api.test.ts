import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, predict, predictBatch } from "./api";

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  } as Response);
}

afterEach(() => vi.restoreAllMocks());

describe("predict", () => {
  it("posts the text and returns the parsed body", async () => {
    const payload = {
      text: "i feel happy",
      label: "joy",
      emoji: "😊",
      confidence: 0.97,
      predictions: [{ label: "joy", score: 0.97 }],
      latency_ms: 42,
      model_source: "transformer",
    };
    const fetchSpy = mockFetch({ json: async () => payload });

    const result = await predict("i feel happy");

    expect(result).toEqual(payload);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/predict$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ text: "i feel happy" });
  });

  it("maps 503 to a retryable 'waking' error with cold-start copy", async () => {
    mockFetch({
      ok: false,
      status: 503,
      json: async () => ({ detail: "loading", code: "model_loading" }),
    });

    const error = await predict("hello").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("waking");
    expect(error.retryable).toBe(true);
    expect(error.message).toMatch(/waking up/i);
  });

  it("maps 422 to a non-retryable validation error and keeps the server's message", async () => {
    mockFetch({
      ok: false,
      status: 422,
      json: async () => ({ detail: "text: must not be empty", code: "validation_error" }),
    });

    const error = await predict("").catch((e) => e);

    expect(error.kind).toBe("validation");
    expect(error.retryable).toBe(false);
    expect(error.message).toBe("text: must not be empty");
  });

  it("maps 429 to a rate-limit error", async () => {
    mockFetch({ ok: false, status: 429, json: async () => ({ detail: "slow down" }) });

    const error = await predict("hello").catch((e) => e);

    expect(error.kind).toBe("rate_limit");
    expect(error.message).toMatch(/too many requests/i);
  });

  it("maps 5xx to a server error", async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({}) });

    const error = await predict("hello").catch((e) => e);

    expect(error.kind).toBe("server");
  });

  it("maps a network failure to an offline error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await predict("hello").catch((e) => e);

    expect(error.kind).toBe("offline");
    expect(error.message).toMatch(/can't reach/i);
  });

  it("never surfaces a caller-initiated abort as an ApiError", async () => {
    const controller = new AbortController();
    vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const pending = predict("hello", { signal: controller.signal }).catch((e) => e);
    controller.abort();
    const error = await pending;

    // Debounce cancellations must stay invisible to the UI.
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it("does not swallow a malformed error body", async () => {
    mockFetch({
      ok: false,
      status: 400,
      json: async () => {
        throw new SyntaxError("not json");
      },
    });

    const error = await predict("hello").catch((e) => e);

    expect(error.kind).toBe("unknown");
    expect(error.message).toMatch(/400/);
  });
});

describe("predictBatch", () => {
  it("sends the texts array", async () => {
    const fetchSpy = mockFetch({
      json: async () => ({ results: [], aggregate: [], dominant: "joy", count: 0, latency_ms: 1 }),
    });

    await predictBatch(["a", "b"]);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/predict\/batch$/);
    expect(JSON.parse(String(init?.body))).toEqual({ texts: ["a", "b"] });
  });
});
