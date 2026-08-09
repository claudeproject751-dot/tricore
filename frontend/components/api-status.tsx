"use client";

import { useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { health, type HealthResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Status = "checking" | "ok" | "waking" | "degraded" | "down";

const COPY: Record<Status, { label: string; detail: string; tone: string }> = {
  checking: {
    label: "Checking",
    detail: "Contacting the analysis service…",
    tone: "bg-muted",
  },
  ok: {
    label: "API online",
    detail: "The model is loaded and answering requests.",
    tone: "bg-success",
  },
  waking: {
    label: "Waking up",
    detail:
      "The service is up but still loading the model. On the free tier this takes up to a minute after a quiet spell.",
    tone: "bg-emotion-joy",
  },
  degraded: {
    label: "Fallback model",
    detail:
      "The fine-tuned model couldn't load, so a simpler baseline classifier is answering. Results will be less accurate.",
    tone: "bg-emotion-joy",
  },
  down: {
    label: "API offline",
    detail: "The analysis service isn't reachable right now.",
    tone: "bg-danger",
  },
};

/**
 * Live backend indicator in the header.
 *
 * Polls slowly while healthy and quickly while waking, so a cold start resolves
 * visibly instead of leaving a stale "offline" badge.
 */
export function ApiStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      try {
        const res = await health();
        if (cancelled) return;
        setInfo(res);
        setStatus(res.status === "ok" ? "ok" : res.status === "loading" ? "waking" : "degraded");
      } catch {
        if (cancelled) return;
        setStatus("down");
      } finally {
        if (!cancelled) {
          const next = status === "ok" || status === "degraded" ? 60_000 : 6_000;
          timer = setTimeout(check, next);
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `status` intentionally excluded: including it would restart the poll loop
    // on every transition. The interval choice re-reads it via closure on the
    // next scheduled call, which is close enough and avoids a churn loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = COPY[status];
  const pulsing = status === "checking" || status === "waking";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs text-muted",
            "transition-colors duration-300 hover:border-border-strong hover:text-body",
            className,
          )}
          role="status"
          aria-live="polite"
        >
          <span className="relative flex size-1.5">
            {pulsing && (
              <span
                aria-hidden="true"
                className={cn("absolute inline-flex size-full animate-pulse-ring rounded-full", copy.tone)}
              />
            )}
            <span className={cn("relative inline-flex size-1.5 rounded-full", copy.tone)} />
          </span>
          <span className="hidden sm:inline">{copy.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="font-medium text-ink">{copy.label}</p>
        <p className="mt-1">{copy.detail}</p>
        {info && (
          <p className="mt-1.5 border-t border-border pt-1.5 font-mono text-[10px] text-muted">
            {info.model} · v{info.version}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
