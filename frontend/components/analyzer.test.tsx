import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Analyzer } from "./analyzer";
import { ApiError } from "@/lib/api";
import { useHistory } from "@/lib/store";

const predictMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, predict: predictMock };
});

function result(label: string, confidence: number) {
  const others = (1 - confidence) / 5;
  const labels = ["sadness", "joy", "love", "anger", "fear", "surprise"];
  return {
    text: "sample",
    label,
    emoji: "😊",
    confidence,
    predictions: labels
      .map((l) => ({ label: l, score: l === label ? confidence : others }))
      .sort((a, b) => b.score - a.score),
    latency_ms: 40,
    model_source: "transformer",
  };
}

beforeEach(() => {
  predictMock.mockReset();
  useHistory.setState({ entries: [] });
  localStorage.clear();
});

describe("Analyzer", () => {
  it("renders a labelled textarea and the empty state", () => {
    render(<Analyzer />);

    expect(screen.getByLabelText(/your text/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing to analyse yet/i)).toBeInTheDocument();
  });

  it("does not call the API before the minimum length is reached", async () => {
    const user = userEvent.setup();
    render(<Analyzer />);

    await user.type(screen.getByLabelText(/your text/i), "hi");

    await new Promise((r) => setTimeout(r, 700));
    expect(predictMock).not.toHaveBeenCalled();
  });

  it("analyses after the debounce and shows the dominant emotion", async () => {
    predictMock.mockResolvedValue(result("joy", 0.93));
    const user = userEvent.setup();
    render(<Analyzer />);

    await user.type(screen.getByLabelText(/your text/i), "i feel wonderful today");

    await waitFor(() => expect(predictMock).toHaveBeenCalled(), { timeout: 3000 });
    expect(await screen.findByRole("heading", { name: "Joy" })).toBeInTheDocument();
    // The score shows in both the header badge and the joy confidence bar.
    expect(await screen.findAllByText("93.0%")).not.toHaveLength(0);
  });

  it("debounces a burst of keystrokes into a single request", async () => {
    predictMock.mockResolvedValue(result("joy", 0.9));
    const user = userEvent.setup();
    render(<Analyzer />);

    await user.type(screen.getByLabelText(/your text/i), "i am feeling really good");

    await waitFor(() => expect(predictMock).toHaveBeenCalled(), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(predictMock).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error when the model is still waking up", async () => {
    predictMock.mockRejectedValue(new ApiError("waking", "The model is waking up."));
    const user = userEvent.setup();
    render(<Analyzer />);

    await user.type(screen.getByLabelText(/your text/i), "i feel wonderful today");

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      /waking up/i,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not offer retry for a validation error", async () => {
    predictMock.mockRejectedValue(new ApiError("validation", "text: too long", 422));
    const user = userEvent.setup();
    render(<Analyzer />);

    await user.type(screen.getByLabelText(/your text/i), "i feel wonderful today");

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      /too long/i,
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("records each successful analysis in session history", async () => {
    predictMock.mockResolvedValue(result("joy", 0.88));
    const user = userEvent.setup();
    render(<Analyzer />);

    await user.type(screen.getByLabelText(/your text/i), "i feel wonderful today");

    await waitFor(() => expect(useHistory.getState().entries).toHaveLength(1), {
      timeout: 3000,
    });
    expect(useHistory.getState().entries[0].label).toBe("joy");
  });

  it("exposes a live status region for screen readers", async () => {
    render(<Analyzer />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("clears the input and returns to the empty state", async () => {
    const user = userEvent.setup();
    render(<Analyzer />);

    const textarea = screen.getByLabelText(/your text/i);
    await user.type(textarea, "something");
    await user.click(screen.getByRole("button", { name: /clear/i }));

    expect(textarea).toHaveValue("");
    expect(screen.getByText(/nothing to analyse yet/i)).toBeInTheDocument();
  });
});
