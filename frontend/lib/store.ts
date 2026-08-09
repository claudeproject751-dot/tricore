"use client";

/**
 * Session history — the analyzer's memory rail.
 *
 * Persisted to localStorage so a refresh doesn't wipe a working session, capped
 * so it can't grow without bound, and deduplicated on identical consecutive
 * text (live analysis fires on every pause in typing).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { PredictResponse } from "./api";

export type HistoryEntry = {
  id: string;
  text: string;
  label: string;
  emoji: string;
  confidence: number;
  predictions: { label: string; score: number }[];
  latencyMs: number;
  createdAt: number;
};

const MAX_ENTRIES = 50;

type HistoryState = {
  entries: HistoryEntry[];
  add: (result: PredictResponse) => void;
  remove: (id: string) => void;
  clear: () => void;
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (result) =>
        set((state) => {
          const text = result.text.trim();
          if (!text) return state;

          // Live analysis re-fires as the user pauses; keep only the newest
          // result for a given piece of text.
          const withoutDuplicate = state.entries.filter((e) => e.text !== text);

          const entry: HistoryEntry = {
            id: makeId(),
            text,
            label: result.label,
            emoji: result.emoji,
            confidence: result.confidence,
            predictions: result.predictions,
            latencyMs: result.latency_ms,
            createdAt: Date.now(),
          };

          return { entries: [entry, ...withoutDuplicate].slice(0, MAX_ENTRIES) };
        }),
      remove: (id) => set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "emotionsense.history.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

/** Distribution of labels across the whole session, for the history summary. */
export function summarise(entries: HistoryEntry[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.label, (counts.get(entry.label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
