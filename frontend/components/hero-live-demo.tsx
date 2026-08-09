"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfidenceBars } from "@/components/confidence-bars";
import { EmotionRadar } from "@/components/emotion-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_TEXTS, formatPercent, metaFor } from "@/lib/emotion-theme";
import { usePrediction } from "@/lib/use-prediction";
import { cn } from "@/lib/utils";

const TYPE_SPEED_MS = 38;
const HOLD_MS = 2600;

/**
 * The landing page's single most important element: the model working, in the
 * hero, before any navigation.
 *
 * It autoplays a rotating set of sentences by typing them character by character
 * — which doubles as a live demonstration of the debounce behaviour — and hands
 * control to the visitor the instant they touch the textarea.
 */
export function HeroLiveDemo() {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [autoplay, setAutoplay] = useState(true);
  const [sampleIndex, setSampleIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { result, phase, error, retry } = usePrediction({ text, debounceMs: 420 });

  const takeOver = useCallback(() => setAutoplay(false), []);

  // Typewriter autoplay. Stops permanently on first user interaction.
  useEffect(() => {
    if (!autoplay) return;

    const target = SAMPLE_TEXTS[sampleIndex % SAMPLE_TEXTS.length].text;

    if (reduceMotion) {
      setText(target);
      const hold = setTimeout(() => setSampleIndex((i) => i + 1), HOLD_MS + 1800);
      return () => clearTimeout(hold);
    }

    let index = 0;
    setText("");

    const timer = setInterval(() => {
      index += 1;
      setText(target.slice(0, index));
      if (index >= target.length) {
        clearInterval(timer);
        setTimeout(() => setSampleIndex((i) => i + 1), HOLD_MS);
      }
    }, TYPE_SPEED_MS);

    return () => clearInterval(timer);
  }, [autoplay, sampleIndex, reduceMotion]);

  const dominant = result ? metaFor(result.label) : null;
  const showSkeleton = (phase === "analyzing" || phase === "waking") && !result;
  const busy = phase === "analyzing" || phase === "waking" || phase === "typing";

  const statusLabel =
    phase === "waking"
      ? "Waking the model…"
      : phase === "analyzing"
        ? "Analysing tone…"
        : phase === "typing"
          ? "Listening…"
          : phase === "error"
            ? "Couldn't analyse"
            : result
              ? `${formatPercent(result.confidence)} ${dominant?.label.toLowerCase()}`
              : "Ready when you are";

  return (
    <div
      className="glass glass-hairline grain relative overflow-hidden p-4 sm:p-6"
      style={
        dominant
          ? ({ ["--dominant" as string]: dominant.color.slice(4, -1) } as React.CSSProperties)
          : undefined
      }
    >
      {/* Emotion-tracking wash behind the demo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.13] transition-all duration-700 ease-product"
        style={{
          background: dominant
            ? `radial-gradient(70% 60% at 20% 0%, ${dominant.color}, transparent 70%)`
            : undefined,
        }}
      />

      <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
        {/* ---------------------------------------------------------- input */}
        <div className="flex flex-col">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <label
              htmlFor="hero-demo-input"
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              Try it now
            </label>
            <StatusPill busy={busy} phase={phase} label={statusLabel} />
          </div>

          <div className="relative">
            <Textarea
              id="hero-demo-input"
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                takeOver();
                setText(e.target.value);
              }}
              onFocus={takeOver}
              onPointerDown={takeOver}
              rows={4}
              maxLength={1000}
              spellCheck={false}
              placeholder="Type how you're feeling…"
              aria-describedby="hero-demo-help"
              className="min-h-[7.5rem] bg-canvas/40 text-base sm:min-h-[8.5rem]"
            />
            {autoplay && !reduceMotion && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-muted"
              >
                autoplaying — start typing to take over
              </span>
            )}
          </div>

          <p id="hero-demo-help" className="mt-2 text-xs text-muted">
            Analyses as you pause. Nothing is stored — results live in your browser only.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {SAMPLE_TEXTS.slice(0, 4).map((sample) => {
              const meta = metaFor(sample.emotion);
              return (
                <button
                  key={sample.emotion}
                  type="button"
                  onClick={() => {
                    takeOver();
                    setText(sample.text);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs text-muted",
                    "transition-all duration-200 ease-product hover:border-border-strong hover:text-ink",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span aria-hidden="true" className="mr-1">
                    {meta.emoji}
                  </span>
                  {meta.label}
                </button>
              );
            })}
            {!autoplay && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setSampleIndex((i) => i + 1);
                  setAutoplay(true);
                }}
                className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Replay demo
              </button>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- output */}
        <div className="flex flex-col rounded-xl border border-border bg-canvas/30 p-4">
          <AnimatePresence mode="wait">
            {phase === "error" && error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center"
              >
                <p className="max-w-[24ch] text-sm leading-relaxed text-body">{error.message}</p>
                {error.retryable && (
                  <Button variant="outline" size="sm" onClick={retry}>
                    Try again
                  </Button>
                )}
              </motion.div>
            ) : text.trim().length < 3 && !result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center"
              >
                <div className="grid size-11 place-items-center rounded-xl border border-border bg-elevated/50 text-lg">
                  <span aria-hidden="true">🫧</span>
                </div>
                <p className="max-w-[26ch] text-sm leading-relaxed text-muted">
                  Write a few words and the six-way breakdown appears here.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col"
              >
                <EmotionRadar scores={result?.predictions ?? null} loading={showSkeleton} height={190} />
                <div className="mt-3 border-t border-border pt-3.5">
                  <ConfidenceBars
                    scores={result?.predictions ?? null}
                    loading={showSkeleton}
                    compact
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="tabular text-xs text-muted">
          {result ? (
            <>
              {result.latency_ms.toFixed(0)}ms round trip
              <span className="mx-2 text-border-strong">·</span>
              6 classes scored
            </>
          ) : (
            "DistilBERT · 6 emotion classes"
          )}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/analyze">
            Open the full workspace
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatusPill({
  busy,
  phase,
  label,
}: {
  busy: boolean;
  phase: string;
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 transition-colors duration-300",
        phase === "error" && "border-danger/30 text-danger",
        phase === "waking" && "border-emotion-joy/40 text-emotion-joy",
      )}
    >
      <span className="relative flex size-1.5">
        {busy && (
          <span
            aria-hidden="true"
            className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-current"
          />
        )}
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      <span aria-live="polite">{label}</span>
    </Badge>
  );
}
