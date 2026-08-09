"use client";

import { motion, useReducedMotion } from "framer-motion";

import { SkeletonBars } from "@/components/ui/skeleton";
import type { EmotionScore } from "@/lib/api";
import { EMOTION_ORDER, formatPercent, metaFor, type Emotion } from "@/lib/emotion-theme";
import { cn } from "@/lib/utils";

/**
 * Full score distribution as animated bars.
 *
 * Bars keep a fixed row order (EMOTION_ORDER) rather than re-sorting on every
 * prediction: a row that stays put and changes length reads as the same emotion
 * changing strength, whereas re-sorting reads as chaos.
 */
export function ConfidenceBars({
  scores,
  loading = false,
  compact = false,
  className,
}: {
  scores: EmotionScore[] | null;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (loading || !scores) {
    return <SkeletonBars rows={6} />;
  }

  const byLabel = new Map(scores.map((s) => [s.label, s.score]));
  const top = scores.reduce((a, b) => (a.score >= b.score ? a : b));

  return (
    <ul
      className={cn("space-y-3.5", compact && "space-y-2.5", className)}
      aria-label="Confidence across all six emotions"
    >
      {EMOTION_ORDER.map((emotion, index) => {
        const score = byLabel.get(emotion) ?? 0;
        const meta = metaFor(emotion);
        const isTop = emotion === top.label;

        return (
          <li key={emotion}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "flex items-center gap-2 text-[13px] transition-colors duration-300",
                  isTop ? "font-medium text-ink" : "text-body",
                )}
              >
                <span aria-hidden="true" className={compact ? "hidden sm:inline" : ""}>
                  {meta.emoji}
                </span>
                {meta.label}
              </span>
              <span
                className={cn(
                  "tabular text-[13px] transition-colors duration-300",
                  isTop ? "text-ink" : "text-muted",
                )}
              >
                {formatPercent(score)}
              </span>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-elevated"
              role="meter"
              aria-valuenow={Math.round(score * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${meta.label} confidence`}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${meta.color}, color-mix(in oklab, ${meta.color} 72%, white))`,
                  boxShadow: isTop ? `0 0 16px -2px ${meta.color}` : undefined,
                }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.max(score * 100, score > 0 ? 1.5 : 0)}%` }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 170, damping: 22, delay: index * 0.035 }
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Aggregate distribution for batch mode: share of texts per emotion. */
export function DistributionBars({
  buckets,
  total,
}: {
  buckets: { label: string; count: number; share: number }[];
  total: number;
}) {
  const reduceMotion = useReducedMotion();
  const byLabel = new Map(buckets.map((b) => [b.label, b]));

  return (
    <ul className="space-y-3" aria-label="Distribution of dominant emotions across the batch">
      {EMOTION_ORDER.map((emotion: Emotion, index) => {
        const bucket = byLabel.get(emotion);
        const count = bucket?.count ?? 0;
        const share = bucket?.share ?? 0;
        const meta = metaFor(emotion);

        return (
          <li key={emotion}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] text-body">
                <span aria-hidden="true">{meta.emoji}</span>
                {meta.label}
              </span>
              <span className="tabular text-[13px] text-muted">
                <span className={count > 0 ? "text-ink" : undefined}>{count}</span>
                <span className="mx-1.5 text-border-strong">/</span>
                {formatPercent(share, 0)}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-elevated"
              role="meter"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label={`${meta.label}: ${count} of ${total}`}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: meta.color }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${share * 100}%` }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 180, damping: 24, delay: index * 0.04 }
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
