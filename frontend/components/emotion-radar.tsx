"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import type { EmotionScore } from "@/lib/api";
import { EMOTION_ORDER, formatPercent, metaFor } from "@/lib/emotion-theme";
import { cn } from "@/lib/utils";

/**
 * Emotional fingerprint of a single text.
 *
 * Recharts animates the polygon between renders, so a new prediction morphs the
 * existing shape rather than redrawing it — the chart reads as *the same text
 * being reconsidered* rather than as a new chart appearing.
 */
export function EmotionRadar({
  scores,
  loading = false,
  height = 260,
  className,
}: {
  scores: EmotionScore[] | null;
  loading?: boolean;
  height?: number;
  className?: string;
}) {
  const { data, dominant } = useMemo(() => {
    const byLabel = new Map((scores ?? []).map((s) => [s.label, s.score]));
    const rows = EMOTION_ORDER.map((emotion) => ({
      emotion,
      label: metaFor(emotion).label,
      value: (byLabel.get(emotion) ?? 0) * 100,
    }));
    const top = (scores ?? []).reduce<EmotionScore | null>(
      (a, b) => (a && a.score >= b.score ? a : b),
      null,
    );
    return { data: rows, dominant: top ? metaFor(top.label) : null };
  }, [scores]);

  if (loading || !scores) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height }}
        aria-hidden="true"
      >
        <div className="relative">
          <Skeleton className="size-40 rounded-full sm:size-48" />
          <div className="absolute inset-0 grid place-items-center">
            <Skeleton className="size-24 rounded-full sm:size-28" />
          </div>
        </div>
      </div>
    );
  }

  const stroke = dominant?.color ?? "hsl(var(--accent))";

  return (
    <div className={className}>
      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <PolarGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted))", fontSize: 11 }}
              tickLine={false}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Confidence"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              fill={stroke}
              fillOpacity={0.22}
              isAnimationActive
              animationDuration={520}
              animationEasing="ease-out"
              dot={{ r: 2.5, fill: stroke, strokeWidth: 0 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader equivalent — a radar polygon conveys nothing without this. */}
      <p className="sr-only">
        Confidence by emotion:{" "}
        {data.map((d) => `${d.label} ${formatPercent(d.value / 100)}`).join(", ")}.
      </p>
    </div>
  );
}
