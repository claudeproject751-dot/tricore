"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PredictResponse } from "@/lib/api";
import { confidenceBand, formatPercent, metaFor } from "@/lib/emotion-theme";
import { cn } from "@/lib/utils";

/**
 * The result hero: what the model decided, how firmly, and why you should or
 * shouldn't trust it. The confidence band exists because a bare top-1 label
 * hides genuine ambiguity — 41% joy and 39% love is not "joy".
 */
export function DominantEmotionCard({
  result,
  loading = false,
  showActions = true,
  className,
}: {
  result: PredictResponse | null;
  loading?: boolean;
  showActions?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  if (loading || !result) {
    return (
      <div className={cn("glass glass-hairline p-6", className)}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
        <Skeleton className="mt-5 h-3.5 w-full" />
        <Skeleton className="mt-2 h-3.5 w-2/3" />
      </div>
    );
  }

  const meta = metaFor(result.label);
  const band = confidenceBand(result.confidence);
  const runnerUp = result.predictions[1];

  async function copyResult() {
    if (!result) return;
    const lines = [
      `"${result.text}"`,
      "",
      `${meta.emoji} ${meta.label} — ${formatPercent(result.confidence)} (${band.label})`,
      "",
      ...result.predictions.map((p) => `${metaFor(p.label).label.padEnd(9)} ${formatPercent(p.score)}`),
      "",
      "Analysed with EmotionSense",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; failing silently is correct
      // here since the button is a convenience, not the primary path.
    }
  }

  async function share() {
    if (!result) return;
    const text = `"${result.text}" reads as ${meta.label.toLowerCase()} (${formatPercent(result.confidence)})`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "EmotionSense", text });
        return;
      } catch {
        // User dismissed the sheet — fall through to clipboard.
      }
    }
    void copyResult();
  }

  return (
    <motion.div
      layout
      style={{ ["--tint" as string]: meta.color.replace("hsl(", "").replace(")", "") }}
      className={cn("glass glass-hairline dominant-glow overflow-hidden p-6", className)}
    >
      {/* Colour wash keyed to the detected emotion. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.16] transition-opacity duration-500"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, ${meta.color}, transparent 70%)` }}
      />

      <div className="relative flex items-start gap-4">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={result.label}
            initial={reduceMotion ? false : { scale: 0.6, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className="grid size-14 shrink-0 place-items-center rounded-2xl border text-3xl"
            style={{
              borderColor: `color-mix(in oklab, ${meta.color} 34%, transparent)`,
              background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
            }}
          >
            <span aria-hidden="true">{meta.emoji}</span>
          </motion.div>
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <AnimatePresence mode="popLayout">
              <motion.h3
                key={result.label}
                initial={reduceMotion ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="text-title font-semibold"
                style={{ color: meta.color }}
              >
                {meta.label}
              </motion.h3>
            </AnimatePresence>
            <Badge variant="outline" className="tabular">
              {formatPercent(result.confidence)}
            </Badge>
            <Badge
              variant={band.key === "unsure" ? "default" : "outline"}
              className={cn(band.key === "unsure" && "text-muted")}
            >
              {band.label}
            </Badge>
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-body">{meta.blurb}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {band.note}
            {band.key !== "certain" && runnerUp && (
              <>
                {" "}
                Runner-up: {metaFor(runnerUp.label).label} at {formatPercent(runnerUp.score)}.
              </>
            )}
          </p>
        </div>
      </div>

      {showActions && (
        <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="tabular text-xs text-muted">
            {result.latency_ms.toFixed(0)}ms
            <span className="mx-2 text-border-strong">·</span>
            {result.model_source === "transformer" ? "DistilBERT" : "baseline fallback"}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={copyResult} aria-live="polite">
              {copied ? <Check className="text-success" /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" onClick={share}>
              <Share2 />
              Share
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
