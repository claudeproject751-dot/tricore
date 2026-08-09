import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { modelInfo, type ModelMetrics } from "./api";

/**
 * Real metrics, never fabricated numbers.
 *
 * Resolution order:
 *   1. `ml/artifacts/metrics.json` in the repo — present once you've trained.
 *   2. `GET /api/model` on the live backend — covers deployments where the
 *      frontend and the artifacts aren't co-located.
 *   3. `null` — the UI then says the model hasn't been evaluated yet rather
 *      than inventing a number.
 */

const METRICS_PATH = path.join(process.cwd(), "..", "ml", "artifacts", "metrics.json");

export async function getMetrics(): Promise<ModelMetrics | null> {
  try {
    const raw = await readFile(METRICS_PATH, "utf-8");
    return JSON.parse(raw) as ModelMetrics;
  } catch {
    // Not trained yet, or the frontend is deployed without the ml/ directory.
  }

  try {
    const info = await modelInfo();
    return info.metrics;
  } catch {
    return null;
  }
}

export type BaselineMetrics = {
  model: string;
  splits: Record<
    string,
    { accuracy: number; f1_macro: number; per_class: Record<string, Record<string, number>> }
  >;
};

const BASELINE_PATH = path.join(process.cwd(), "..", "ml", "artifacts", "baseline_metrics.json");

export async function getBaselineMetrics(): Promise<BaselineMetrics | null> {
  try {
    return JSON.parse(await readFile(BASELINE_PATH, "utf-8")) as BaselineMetrics;
  } catch {
    return null;
  }
}

export type ClassDistribution = Record<
  string,
  { total: number; counts: Record<string, number>; percentages: Record<string, number> }
>;

const DISTRIBUTION_PATH = path.join(
  process.cwd(),
  "..",
  "ml",
  "artifacts",
  "class_distribution.json",
);

export async function getClassDistribution(): Promise<ClassDistribution | null> {
  try {
    return JSON.parse(await readFile(DISTRIBUTION_PATH, "utf-8")) as ClassDistribution;
  } catch {
    return null;
  }
}

/**
 * Numbers the marketing surfaces quote. When nothing has been evaluated yet the
 * labels read "—" instead of a made-up figure, and `hasRealMetrics` lets the
 * copy adjust its claims accordingly.
 */
export function headlineStats(metrics: ModelMetrics | null) {
  const evaluation = metrics?.evaluation;
  const baseline = metrics?.baseline_comparison;

  return {
    hasRealMetrics: Boolean(evaluation),
    accuracy: evaluation?.accuracy ?? null,
    accuracyLabel: evaluation ? `${(evaluation.accuracy * 100).toFixed(1)}%` : "—",
    f1: evaluation?.f1_macro ?? null,
    f1Label: evaluation ? evaluation.f1_macro.toFixed(3) : "—",
    baselineLabel: baseline ? `${(baseline.accuracy * 100).toFixed(1)}%` : "—",
    baselineDelta:
      evaluation && baseline ? evaluation.f1_macro - baseline.f1_macro : null,
    trainRows: metrics?.dataset.splits.train ?? 16_000,
    testRows: metrics?.dataset.splits.test ?? 2_000,
    validationRows: metrics?.dataset.splits.validation ?? 2_000,
    parameters: metrics?.model.parameters ?? 66_960_000,
    baseModel: metrics?.model.base ?? "distilbert-base-uncased",
  };
}
