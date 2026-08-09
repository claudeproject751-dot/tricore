"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Download,
  FileUp,
  Loader2,
  Play,
  RotateCcw,
  Table2,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { DistributionBars } from "@/components/confidence-bars";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, predictBatch, type BatchPredictResponse } from "@/lib/api";
import { EMOTION_ORDER, formatPercent, metaFor } from "@/lib/emotion-theme";
import { cn, downloadFile, extractTextColumn, parseCsv, toCsv, truncate } from "@/lib/utils";

const MAX_ITEMS = 200;
const MAX_CHARS = 1000;

type Phase = "idle" | "running" | "waking" | "done" | "error";

export function BatchWorkspace() {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [response, setResponse] = useState<BatchPredictResponse | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [raw],
  );

  const overLimit = lines.length > MAX_ITEMS;
  const oversizedLine = lines.find((l) => l.length > MAX_CHARS);
  const canRun = lines.length > 0 && !overLimit && !oversizedLine && phase !== "running";

  const run = useCallback(async () => {
    if (lines.length === 0) return;
    setPhase("running");
    setError(null);

    const wakingTimer = setTimeout(() => {
      setPhase((p) => (p === "running" ? "waking" : p));
    }, 3000);

    try {
      const result = await predictBatch(lines.slice(0, MAX_ITEMS));
      setResponse(result);
      setPhase("done");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("unknown", "Something went wrong."));
      setPhase("error");
    } finally {
      clearTimeout(wakingTimer);
    }
  }, [lines]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (file.size > 2_000_000) {
      setError(new ApiError("validation", "That file is over 2MB. Try a smaller export."));
      setPhase("error");
      return;
    }

    const text = await file.text();
    const extracted = file.name.toLowerCase().endsWith(".csv")
      ? extractTextColumn(parseCsv(text))
      : text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    if (extracted.length === 0) {
      setError(new ApiError("validation", "No usable text rows found in that file."));
      setPhase("error");
      return;
    }

    setFileName(file.name);
    setRaw(extracted.join("\n"));
    setPhase("idle");
    setResponse(null);
  }, []);

  function exportCsv() {
    if (!response) return;
    const header = ["text", "label", "confidence", ...EMOTION_ORDER];
    const rows = response.results.map((r) => {
      const byLabel = new Map(r.predictions.map((p) => [p.label, p.score]));
      return [
        r.text,
        r.label,
        r.confidence.toFixed(6),
        ...EMOTION_ORDER.map((e) => (byLabel.get(e) ?? 0).toFixed(6)),
      ];
    });
    downloadFile(
      `emotionsense-results-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...rows]),
    );
  }

  function reset() {
    setRaw("");
    setFileName(null);
    setResponse(null);
    setError(null);
    setPhase("idle");
  }

  const busy = phase === "running" || phase === "waking";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start xl:gap-6">
      {/* ------------------------------------------------------------- input */}
      <div className="space-y-5 lg:sticky lg:top-20">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Input</CardTitle>
            <p className="text-sm text-muted">
              One text per line, or drop a CSV. Up to {MAX_ITEMS} rows per run.
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs defaultValue="paste">
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1">
                  <Table2 className="size-3.5" aria-hidden="true" />
                  Paste lines
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1">
                  <FileUp className="size-3.5" aria-hidden="true" />
                  Upload CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste">
                <label htmlFor="batch-input" className="sr-only">
                  Texts to analyse, one per line
                </label>
                <Textarea
                  id="batch-input"
                  value={raw}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    setFileName(null);
                  }}
                  rows={11}
                  spellCheck={false}
                  placeholder={"i loved every minute of it\ni cant believe they did that\ni feel so tired lately"}
                  aria-describedby="batch-count"
                  className="min-h-[15rem] font-mono text-[13px] leading-relaxed"
                />
              </TabsContent>

              <TabsContent value="upload">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void handleFile(file);
                  }}
                  className={cn(
                    "flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors duration-200",
                    dragging
                      ? "border-accent bg-accent/5"
                      : "border-border-strong bg-elevated/30 hover:border-muted",
                  )}
                >
                  <div className="grid size-11 place-items-center rounded-xl border border-border bg-elevated">
                    <FileUp className="size-4 text-muted" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">Drop a .csv or .txt file</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      We&apos;ll use the column named <code className="font-mono">text</code>, or the
                      longest column if there isn&apos;t one.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose a file
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                      e.target.value = "";
                    }}
                  />
                  {fileName && (
                    <Badge variant="outline" className="mt-1 max-w-full">
                      <span className="truncate">{fileName}</span>
                    </Badge>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between gap-3">
              <p id="batch-count" className="tabular text-xs text-muted">
                <span className={cn(overLimit ? "text-danger" : "text-body")}>{lines.length}</span>
                {" / "}
                {MAX_ITEMS} rows
              </p>
              {raw.length > 0 && (
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted">
                  <Trash2 />
                  Clear
                </Button>
              )}
            </div>

            {overLimit && (
              <Alert variant="warning">
                <AlertCircle aria-hidden="true" />
                <AlertDescription>
                  Only the first {MAX_ITEMS} rows will be analysed — {lines.length - MAX_ITEMS} will
                  be skipped. Split the file to cover everything.
                </AlertDescription>
              </Alert>
            )}

            {oversizedLine && (
              <Alert variant="danger">
                <AlertCircle aria-hidden="true" />
                <AlertDescription>
                  One row is {oversizedLine.length} characters — the limit is {MAX_CHARS}. Shorten it
                  and try again.
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={run} disabled={!canRun} className="w-full" size="lg">
              {busy ? <Loader2 className="animate-spin" /> : <Play />}
              {phase === "waking"
                ? "Waking the model…"
                : phase === "running"
                  ? `Analysing ${Math.min(lines.length, MAX_ITEMS)} rows…`
                  : `Analyse ${lines.length || ""} ${lines.length === 1 ? "row" : "rows"}`.trim()}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------ output */}
      <div className="space-y-5">
        <AnimatePresence mode="wait">
          {phase === "error" && error ? (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Alert variant="danger">
                <AlertCircle aria-hidden="true" />
                <div className="flex-1">
                  <AlertTitle>Batch analysis failed</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </div>
                {error.retryable && (
                  <Button variant="outline" size="sm" onClick={run} className="self-center">
                    <RotateCcw />
                    Retry
                  </Button>
                )}
              </Alert>
            </motion.div>
          ) : busy ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingResults count={Math.min(lines.length, MAX_ITEMS)} waking={phase === "waking"} />
            </motion.div>
          ) : response ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <Results response={response} onExport={exportCsv} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyResults onLoadSample={() => setRaw(SAMPLE_BATCH.join("\n"))} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Results({
  response,
  onExport,
}: {
  response: BatchPredictResponse;
  onExport: () => void;
}) {
  const dominant = metaFor(response.dominant);

  return (
    <>
      <Card
        style={{ ["--dominant" as string]: dominant.color.slice(4, -1) } as React.CSSProperties}
        className="dominant-glow"
      >
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Distribution</CardTitle>
            <p className="mt-1 text-sm text-muted">
              <span className="tabular text-body">{response.count}</span> rows · mostly{" "}
              <span style={{ color: dominant.color }}>{dominant.label.toLowerCase()}</span> ·{" "}
              <span className="tabular">{response.latency_ms.toFixed(0)}ms</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </CardHeader>
        <CardContent>
          <DistributionBars buckets={response.aggregate} total={response.count} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>Per-row results</CardTitle>
          <p className="text-sm text-muted">Sorted as submitted. Hover a row for the full text.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Emotion classification for each submitted row, with confidence
              </caption>
              <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                <tr className="border-b border-border">
                  <th scope="col" className="px-5 py-2.5 text-xs font-medium text-muted">
                    Text
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-medium text-muted">
                    Emotion
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right text-xs font-medium text-muted">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {response.results.map((row, index) => {
                  const meta = metaFor(row.label);
                  return (
                    <tr key={`${index}-${row.text.slice(0, 12)}`} className="transition-colors hover:bg-elevated/50">
                      <td className="max-w-0 px-5 py-2.5">
                        <span className="block truncate text-[13px] text-body" title={row.text}>
                          {truncate(row.text, 90)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                          style={{
                            borderColor: `color-mix(in oklab, ${meta.color} 30%, transparent)`,
                            background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
                            color: meta.color,
                          }}
                        >
                          <span aria-hidden="true">{meta.emoji}</span>
                          {meta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right">
                        <span className="tabular text-[13px] text-muted">
                          {formatPercent(row.confidence)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function LoadingResults({ count, waking }: { count: number; waking: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{waking ? "Waking the model…" : `Analysing ${count} rows…`}</CardTitle>
        <p className="text-sm text-muted">
          {waking
            ? "The free-tier backend sleeps when idle. First request after a quiet spell takes up to a minute."
            : "Every row is scored across all six classes in a single request."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 flex-1" style={{ maxWidth: `${72 - i * 7}%` }} />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyResults({ onLoadSample }: { onLoadSample: () => void }) {
  return (
    <Card className="grain">
      <CardContent className="flex flex-col items-center gap-5 px-6 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-elevated/60">
          <Table2 className="size-5 text-muted" aria-hidden="true" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-title font-semibold">No results yet</h3>
          <p className="text-sm leading-relaxed text-body">
            Paste some lines or drop a CSV, then run the batch. You&apos;ll get a per-row table, the
            aggregate distribution, and a CSV export.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onLoadSample}>
          Load a sample batch
        </Button>
      </CardContent>
    </Card>
  );
}

const SAMPLE_BATCH = [
  "i cant stop smiling this is the best news all year",
  "i feel so empty and alone since everyone left",
  "i feel so loved and cared for by my family",
  "i am absolutely furious about how they handled this",
  "i feel terrified about what might happen tomorrow",
  "i cant believe this actually happened i am stunned",
  "i had a really lovely time with everyone today",
  "i am so tired of being ignored every single time",
  "i feel hopeful that things are finally turning around",
  "i keep worrying that something will go wrong again",
];
