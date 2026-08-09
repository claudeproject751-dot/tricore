"use client";

import { AnimatePresence, motion } from "framer-motion";
import { History, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatPercent, metaFor } from "@/lib/emotion-theme";
import { summarise, useHistory, type HistoryEntry } from "@/lib/store";
import { cn, timeAgo, truncate } from "@/lib/utils";

/**
 * Session history rail.
 *
 * Rendering is gated on a mount flag because the store is localStorage-backed:
 * without it, the server-rendered empty rail and the hydrated rail disagree.
 */
export function HistoryPanel({
  onSelect,
  className,
}: {
  onSelect: (entry: HistoryEntry) => void;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const entries = useHistory((s) => s.entries);
  const remove = useHistory((s) => s.remove);
  const clear = useHistory((s) => s.clear);

  useEffect(() => setMounted(true), []);

  const summary = summarise(entries);

  return (
    <aside
      className={cn("glass glass-hairline flex flex-col overflow-hidden", className)}
      aria-labelledby="history-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h2
          id="history-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <History className="size-4 text-muted" aria-hidden="true" />
          Session history
        </h2>
        {mounted && entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted">
            <Trash2 />
            <span className="sr-only sm:not-sr-only">Clear</span>
          </Button>
        )}
      </div>

      {/* Distribution strip: at a glance, what this session has felt like. */}
      {mounted && entries.length > 1 && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-elevated">
            {summary.map((s) => (
              <div
                key={s.label}
                className="h-full transition-all duration-500 ease-product"
                style={{
                  width: `${(s.count / entries.length) * 100}%`,
                  background: metaFor(s.label).color,
                }}
                title={`${metaFor(s.label).label}: ${s.count}`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            <span className="tabular text-body">{entries.length}</span> analysed ·{" "}
            mostly {metaFor(summary[0].label).label.toLowerCase()}
          </p>
        </div>
      )}

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {!mounted ? (
          <div className="space-y-2 p-4" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="grid size-10 place-items-center rounded-xl border border-border bg-elevated/50">
              <History className="size-4 text-muted" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-body">Nothing analysed yet</p>
            <p className="max-w-[24ch] text-xs leading-relaxed text-muted">
              Everything you analyse lands here. Stored in this browser only, never sent anywhere.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {entries.map((entry) => {
                const meta = metaFor(entry.label);
                return (
                  <motion.li
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="group relative"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      className="flex w-full items-start gap-3 p-3.5 text-left transition-colors duration-200 hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border text-sm"
                        style={{
                          borderColor: `color-mix(in oklab, ${meta.color} 32%, transparent)`,
                          background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
                        }}
                      >
                        {meta.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] leading-snug text-body">
                          {truncate(entry.text, 64)}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                          <span style={{ color: meta.color }}>{meta.label}</span>
                          <span className="tabular">{formatPercent(entry.confidence, 0)}</span>
                          <span className="text-border-strong">·</span>
                          <span>{timeAgo(entry.createdAt)}</span>
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      aria-label={`Remove "${truncate(entry.text, 30)}" from history`}
                      className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted opacity-0 transition-all duration-150 hover:bg-elevated hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </aside>
  );
}
