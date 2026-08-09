import "server-only";

import { modelInfo, type ModelMetrics } from "./api";
// Generated at build time by scripts/sync-metrics.mjs from ml/artifacts/.
// Imported (not read from disk) so it is bundled into the serverless output —
// `ml/` sits outside the Next.js root and is not traced into the deployment.
import bundled from "./generated/model-data.json";

/**
 * Real metrics, never fabricated numbers.
 *
 * Resolution order:
 *   1. The bundled artifacts from `ml/artifacts/` — present once you've trained.
 *   2. `GET /api/model` on the live backend — covers a frontend deployed
 *      without the ml/ directory alongside it.
 *   3. `null` — the UI then states the model hasn't been evaluated rather than
 *      inventing a number.
 */

export type BaselineMetrics = {
  model: string;
  splits: Record<
    string,
    { accuracy: number; f1_macro: number; per_class: Record<string, Record<string, number>> }
  >;
};

export type ClassDistribution = Record<
  string,
  { total: number; counts: Record<string, number>; percentages: Record<string, number> }
>;

export async function getMetrics(): Promise<ModelMetrics | null> {
  if (bundled.metrics) {
    return bundled.metrics as unknown as ModelMetrics;
  }

  try {
    const info = await modelInfo();
    return info.metrics;
  } catch {
    // Backend asleep or unreachable at build time — fall through to null so the
    // page renders honestly instead of failing.
    return null;
  }
}

export async function getBaselineMetrics(): Promise<BaselineMetrics | null> {
  return (bundled.baseline as unknown as BaselineMetrics) ?? null;
}

export async function getClassDistribution(): Promise<ClassDistribution | null> {
  return (bundled.distribution as unknown as ClassDistribution) ?? null;
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
    baselineDelta: evaluation && baseline ? evaluation.f1_macro - baseline.f1_macro : null,
    trainRows: metrics?.dataset.splits.train ?? 16_000,
    testRows: metrics?.dataset.splits.test ?? 2_000,
    validationRows: metrics?.dataset.splits.validation ?? 2_000,
    parameters: metrics?.model.parameters ?? 66_960_000,
    baseModel: metrics?.model.base ?? "distilbert-base-uncased",
  };
}
