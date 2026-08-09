import { AlertTriangle, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { GradientMeshBg } from "@/components/gradient-mesh-bg";
import { Reveal } from "@/components/reveal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";
import { EMOTION_ORDER, metaFor } from "@/lib/emotion-theme";
import {
  getBaselineMetrics,
  getClassDistribution,
  getMetrics,
  headlineStats,
} from "@/lib/metrics";
import { formatCount } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Model & metrics",
  description:
    "How EmotionSense was built: the dataset, the fine-tuning setup, real held-out test metrics, per-class performance, and the limitations you should know about.",
};

const STACK = [
  { layer: "Model", value: "DistilBERT, 6-way classification head" },
  { layer: "Training", value: "PyTorch · Transformers · Kaggle T4" },
  { layer: "Serving", value: "FastAPI · Uvicorn · Docker on Render" },
  { layer: "Frontend", value: "Next.js 14 · TypeScript · Tailwind" },
  { layer: "Visuals", value: "Framer Motion · Recharts" },
  { layer: "Model host", value: "Hugging Face Hub" },
];

export default async function AboutPage() {
  const [metrics, baseline, distribution] = await Promise.all([
    getMetrics(),
    getBaselineMetrics(),
    getClassDistribution(),
  ]);
  const stats = headlineStats(metrics);

  return (
    <>
      <GradientMeshBg />

      <div className="container max-w-4xl py-12 sm:py-16">
        {/* ------------------------------------------------------------ intro */}
        <Reveal>
          <Badge variant="outline">About</Badge>
          <h1 className="mt-4 text-headline font-semibold">
            A small model, honestly measured.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-body">
            EmotionSense classifies short English text into six emotions. Everything on this page —
            every accuracy figure, every per-class score — is read from the evaluation artifacts
            produced by the training run. Nothing here is a marketing number.
          </p>
        </Reveal>

        {/* ---------------------------------------------------------- metrics */}
        <Reveal delay={0.06}>
          <section className="mt-12" aria-labelledby="metrics-heading">
            <h2 id="metrics-heading" className="text-title font-semibold">
              Held-out test performance
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              {stats.hasRealMetrics ? (
                <>
                  Scored on the {formatCount(stats.testRows)}-example test split, which was never
                  seen during training or checkpoint selection.
                </>
              ) : (
                <>
                  The transformer hasn&apos;t been evaluated in this checkout yet. Run the Kaggle
                  notebook in <code className="font-mono text-xs">ml/notebooks/</code>, drop the
                  resulting <code className="font-mono text-xs">metrics.json</code> into{" "}
                  <code className="font-mono text-xs">ml/artifacts/</code>, and this section fills
                  itself in.
                </>
              )}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
              {[
                { label: "Accuracy", value: stats.accuracyLabel },
                { label: "Macro F1", value: stats.f1Label },
                {
                  label: "Weighted F1",
                  value: metrics ? metrics.evaluation.f1_weighted.toFixed(3) : "—",
                },
                { label: "Test rows", value: formatCount(stats.testRows) },
              ].map((cell) => (
                <div key={cell.label} className="bg-surface p-5">
                  <dt className="text-xs text-muted">{cell.label}</dt>
                  <dd className="tabular mt-1.5 text-xl font-semibold text-ink">{cell.value}</dd>
                </div>
              ))}
            </dl>

            {baseline && (
              <p className="mt-4 text-sm leading-relaxed text-body">
                A TF-IDF + logistic-regression baseline trained on the same data reaches{" "}
                <span className="tabular text-ink">
                  {(baseline.splits.test.accuracy * 100).toFixed(2)}%
                </span>{" "}
                accuracy and{" "}
                <span className="tabular text-ink">
                  {baseline.splits.test.f1_macro.toFixed(3)}
                </span>{" "}
                macro-F1 on this same split.
                {stats.baselineDelta !== null && (
                  <>
                    {" "}
                    The fine-tuned transformer adds{" "}
                    <span className="tabular text-ink">
                      {stats.baselineDelta >= 0 ? "+" : ""}
                      {stats.baselineDelta.toFixed(3)}
                    </span>{" "}
                    macro-F1 over it.
                  </>
                )}{" "}
                The baseline is kept as a fallback: if the transformer can&apos;t load, the API
                serves it and labels every response accordingly rather than going dark.
              </p>
            )}
          </section>
        </Reveal>

        {/* -------------------------------------------------------- per class */}
        {metrics && (
          <Reveal delay={0.06}>
            <section className="mt-12" aria-labelledby="perclass-heading">
              <h2 id="perclass-heading" className="text-title font-semibold">
                Per-class performance
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                Aggregate accuracy hides where a model struggles. These are the numbers that matter.
              </p>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <caption className="sr-only">
                    Precision, recall, F1 and support for each emotion class on the test split
                  </caption>
                  <thead className="bg-surface">
                    <tr className="border-b border-border">
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-muted">
                        Emotion
                      </th>
                      {["Precision", "Recall", "F1", "Support"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-3 text-right text-xs font-medium text-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface/50">
                    {EMOTION_ORDER.map((emotion) => {
                      const row = metrics.per_class[emotion];
                      if (!row) return null;
                      const meta = metaFor(emotion);
                      return (
                        <tr key={emotion}>
                          <th scope="row" className="px-5 py-3 font-normal">
                            <span className="flex items-center gap-2" style={{ color: meta.color }}>
                              <span aria-hidden="true">{meta.emoji}</span>
                              {meta.label}
                            </span>
                          </th>
                          {[row.precision, row.recall, row.f1].map((value, i) => (
                            <td key={i} className="tabular px-4 py-3 text-right text-body">
                              {value.toFixed(3)}
                            </td>
                          ))}
                          <td className="tabular px-4 py-3 text-right text-muted">{row.support}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </Reveal>
        )}

        {/* ---------------------------------------------------------- dataset */}
        <Reveal delay={0.06}>
          <section className="mt-12" aria-labelledby="dataset-heading">
            <h2 id="dataset-heading" className="text-title font-semibold">
              The dataset
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              <a
                href="https://huggingface.co/datasets/dair-ai/emotion"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-ink underline-offset-2 hover:underline"
              >
                dair-ai/emotion
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>{" "}
              — {formatCount(stats.trainRows)} training, {formatCount(stats.validationRows)}{" "}
              validation and {formatCount(stats.testRows)} test English tweets, each labelled with
              one of six emotions. Introduced by Saravia et al. in{" "}
              <em>CARER: Contextualized Affect Representations for Emotion Recognition</em>{" "}
              (EMNLP 2018).
            </p>

            {distribution?.train && (
              <div className="mt-5 rounded-2xl border border-border bg-surface/50 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  Training distribution
                </p>
                <ul className="mt-4 space-y-2.5">
                  {EMOTION_ORDER.map((emotion) => {
                    const count = distribution.train.counts[emotion] ?? 0;
                    const pct = distribution.train.percentages[emotion] ?? 0;
                    const meta = metaFor(emotion);
                    return (
                      <li key={emotion} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(pct / 40) * 100}%`, background: meta.color }}
                          />
                        </span>
                        <span className="tabular w-24 shrink-0 text-right text-xs text-muted">
                          {formatCount(count)} · {pct.toFixed(1)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  The classes are heavily imbalanced — joy appears roughly nine times more often than
                  surprise. That&apos;s why checkpoints are selected on macro-F1 rather than accuracy:
                  a model that ignored surprise entirely would still score well on accuracy alone.
                </p>
              </div>
            )}
          </section>
        </Reveal>

        {/* ------------------------------------------------------ limitations */}
        <Reveal delay={0.06}>
          <section className="mt-12" aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="text-title font-semibold">
              What it can&apos;t do
            </h2>

            <Alert variant="warning" className="mt-4">
              <AlertTriangle aria-hidden="true" />
              <div>
                <AlertTitle>Not a clinical or diagnostic instrument</AlertTitle>
                <AlertDescription>
                  EmotionSense infers tone from wording alone. It must not be used for mental-health
                  screening, hiring, unreviewed moderation, or any decision affecting a
                  person&apos;s rights or wellbeing.
                </AlertDescription>
              </div>
            </Alert>

            <ul className="mt-5 space-y-3.5 text-sm leading-relaxed text-body">
              {[
                [
                  "It expects a particular register.",
                  "The training data is English tweets, most of which literally begin with “i feel…”. Formal prose, long documents and other languages are out of distribution, and confidence there is poorly calibrated.",
                ],
                [
                  "Six classes, always one winner.",
                  "Neutral, mixed and sarcastic text has no correct answer available — the model still has to pick. Read the runner-up score before trusting a low-confidence result.",
                ],
                [
                  "Rare classes are weaker.",
                  "Surprise is about 3.6% of the training data and love about 8%. Their recall is measurably lower than joy's or sadness's, as the per-class table shows.",
                ],
                [
                  "It inherits its data's biases.",
                  "Both the source corpus and DistilBERT's pretraining carry social biases that this fine-tune does not correct.",
                ],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" />
                  <span>
                    <strong className="font-medium text-ink">{title}</strong> {body}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        {/* ------------------------------------------------------------ stack */}
        <Reveal delay={0.06}>
          <section className="mt-12" aria-labelledby="stack-heading">
            <h2 id="stack-heading" className="text-title font-semibold">
              How it&apos;s built
            </h2>
            <Card className="mt-4">
              <CardContent className="p-0">
                <dl className="divide-y divide-border">
                  {STACK.map((row) => (
                    <div key={row.layer} className="flex items-baseline gap-4 px-5 py-3.5">
                      <dt className="w-28 shrink-0 text-xs uppercase tracking-[0.1em] text-muted">
                        {row.layer}
                      </dt>
                      <dd className="text-sm text-body">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">API reference</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted">
                    The backend ships interactive OpenAPI docs — try the endpoints directly.
                  </p>
                  <a
                    href={`${API_URL}/docs`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink underline-offset-2 hover:underline"
                  >
                    Open /docs
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Licensing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted">
                    The dataset card states the data is for research and educational use. This
                    project is built and published on that basis; the code is MIT licensed.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </Reveal>
      </div>
    </>
  );
}
