"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Eraser, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfidenceBars } from "@/components/confidence-bars";
import { DominantEmotionCard } from "@/components/dominant-emotion-card";
import { EmotionRadar } from "@/components/emotion-radar";
import { HistoryPanel } from "@/components/history-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { PredictResponse } from "@/lib/api";
import { SAMPLE_TEXTS, metaFor } from "@/lib/emotion-theme";
import { useHistory, type HistoryEntry } from "@/lib/store";
import { usePrediction } from "@/lib/use-prediction";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 1000;

/**
 * The analyzer workspace: a form, treated like a form.
 *
 * Live analysis is debounced rather than submit-driven, but the markup is still
 * a labelled `<form>` with a real submit path so keyboard and screen-reader
 * users are not dependent on the debounce firing.
 */
export function Analyzer() {
  const [text, setText] = useState("");
  const [restored, setRestored] = useState<PredictResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addToHistory = useHistory((s) => s.add);

  const { result, phase, error, retry } = usePrediction({ text, debounceMs: 400 });

  // A restored history entry stands in until live analysis produces a fresh result.
  const active = result ?? restored;

  useEffect(() => {
    if (result) {
      setRestored(null);
      addToHistory(result);
    }
  }, [result, addToHistory]);

  const handleSelect = useCallback((entry: HistoryEntry) => {
    setText(entry.text);
    setRestored({
      text: entry.text,
      label: entry.label,
      emoji: entry.emoji,
      confidence: entry.confidence,
      predictions: entry.predictions,
      latency_ms: entry.latencyMs,
      model_source: "transformer",
    });
    textareaRef.current?.focus();
  }, []);

  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 3;
  const busy = phase === "analyzing" || phase === "waking";
  const showSkeleton = busy && !active;
  const dominant = active ? metaFor(active.label) : null;

  const statusMessage =
    phase === "waking"
      ? "Waking the model — up to a minute on the free tier"
      : phase === "analyzing"
        ? "Analysing tone…"
        : phase === "typing"
          ? "Waiting for you to pause…"
          : tooShort
            ? "A few more characters, please"
            : active
              ? `Detected ${metaFor(active.label).label.toLowerCase()}`
              : "Ready";

  return (
    <div
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6"
      style={
        dominant
          ? ({ ["--dominant" as string]: dominant.color.slice(4, -1) } as React.CSSProperties)
          : undefined
      }
    >
      <div className="space-y-5">
        {/* ------------------------------------------------------------ input */}
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              retry();
            }}
          >
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle>
                  <label htmlFor="analyzer-input">Your text</label>
                </CardTitle>
                <p className="mt-1 text-sm text-muted">
                  Analyses automatically as you pause typing.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const pick = SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
                    setText(pick.text);
                    textareaRef.current?.focus();
                  }}
                >
                  <Wand2 />
                  <span className="hidden sm:inline">Example</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText("");
                    setRestored(null);
                    textareaRef.current?.focus();
                  }}
                  disabled={text.length === 0}
                >
                  <Eraser />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <Textarea
                id="analyzer-input"
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                rows={6}
                maxLength={MAX_LENGTH}
                autoFocus
                placeholder="Paste a message, a journal line, a review — anything short and human."
                aria-describedby="analyzer-status analyzer-count"
                aria-invalid={phase === "error" || undefined}
                className="min-h-[9rem] text-base sm:min-h-[10.5rem]"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p
                  id="analyzer-status"
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 text-xs text-muted"
                >
                  {busy && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                  {statusMessage}
                </p>
                <p
                  id="analyzer-count"
                  className={cn(
                    "tabular text-xs",
                    text.length > MAX_LENGTH * 0.9 ? "text-emotion-joy" : "text-muted",
                  )}
                >
                  {text.length}/{MAX_LENGTH}
                </p>
              </div>

              {/* Non-visual submit path for keyboard users who don't wait for debounce. */}
              <button type="submit" className="sr-only">
                Analyse text
              </button>
            </CardContent>
          </form>
        </Card>

        {/* ------------------------------------------------------------ error */}
        <AnimatePresence>
          {phase === "error" && error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Alert variant={error.kind === "validation" ? "warning" : "danger"}>
                <AlertCircle aria-hidden="true" />
                <div className="flex-1">
                  <AlertTitle>
                    {error.kind === "waking"
                      ? "Waking the model"
                      : error.kind === "validation"
                        ? "That input can't be analysed"
                        : "Analysis failed"}
                  </AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </div>
                {error.retryable && (
                  <Button variant="outline" size="sm" onClick={retry} className="self-center">
                    Retry
                  </Button>
                )}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ----------------------------------------------------------- result */}
        {trimmed.length < 3 && !active ? (
          <EmptyState onPick={(t) => setText(t)} />
        ) : (
          <>
            <DominantEmotionCard result={active} loading={showSkeleton} />

            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Confidence breakdown</CardTitle>
                  <p className="text-sm text-muted">Every class, not just the winner.</p>
                </CardHeader>
                <CardContent className="pt-3">
                  <ConfidenceBars scores={active?.predictions ?? null} loading={showSkeleton} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-0">
                  <CardTitle>Emotional fingerprint</CardTitle>
                  <p className="text-sm text-muted">The overall shape of the response.</p>
                </CardHeader>
                <CardContent className="pt-1">
                  <EmotionRadar
                    scores={active?.predictions ?? null}
                    loading={showSkeleton}
                    height={252}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ---------------------------------------------------------- history */}
      <HistoryPanel
        onSelect={handleSelect}
        className="max-h-[34rem] lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]"
      />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <Card className="grain overflow-hidden">
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <div className="relative grid size-14 place-items-center rounded-2xl border border-border bg-elevated/60">
          <Sparkles className="size-5 text-muted" aria-hidden="true" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-title font-semibold">Nothing to analyse yet</h3>
          <p className="text-sm leading-relaxed text-body">
            Type at least a few words above, or start from one of these — each is a clear example of
            a different class.
          </p>
        </div>
        <ul className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {SAMPLE_TEXTS.map((sample) => {
            const meta = metaFor(sample.emotion);
            return (
              <li key={sample.emotion}>
                <button
                  type="button"
                  onClick={() => onPick(sample.text)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border border-border bg-elevated/40 p-3 text-left",
                    "transition-all duration-200 ease-product",
                    "hover:-translate-y-px hover:border-border-strong hover:bg-elevated",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {meta.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {sample.text}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
