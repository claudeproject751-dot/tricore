import { ArrowRight, BarChart3, Cpu, Gauge, Layers, Sparkles, Type } from "lucide-react";
import Link from "next/link";

import { GradientMeshBg } from "@/components/gradient-mesh-bg";
import { HeroLiveDemo } from "@/components/hero-live-demo";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMetrics, headlineStats } from "@/lib/metrics";
import { EMOTION_ORDER, metaFor } from "@/lib/emotion-theme";
import { formatCount } from "@/lib/utils";

export default async function LandingPage() {
  const metrics = await getMetrics();
  const stats = headlineStats(metrics);

  return (
    <>
      <GradientMeshBg />

      {/* ------------------------------------------------------------- hero */}
      <section className="relative">
        <div className="container grid gap-10 pb-16 pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:pb-24 lg:pt-20">
          <div>
            <Reveal>
              <Badge variant="outline" className="gap-1.5">
                <Sparkles className="size-3" aria-hidden="true" />
                DistilBERT · {stats.accuracyLabel} accuracy
              </Badge>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-5 text-display font-semibold">
                <span className="text-gradient">Read the emotion</span>
                <br />
                behind the words.
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-body">
                EmotionSense scores any sentence across six emotions in milliseconds — and shows you
                the full confidence breakdown, not just the winner.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/analyze">
                    Open the analyzer
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/about">See how it performs</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
                {[
                  { value: stats.accuracyLabel, label: "test accuracy" },
                  { value: formatCount(stats.trainRows), label: "labelled examples" },
                  { value: "6", label: "emotion classes" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="tabular block text-2xl font-semibold text-ink">
                        {stat.value}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="lg:pl-2">
            <HeroLiveDemo />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ the palette */}
      <section className="container py-6" aria-labelledby="classes-heading">
        <Reveal>
          <h2 id="classes-heading" className="sr-only">
            The six emotion classes
          </h2>
          <ul className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {EMOTION_ORDER.map((emotion) => {
              const meta = metaFor(emotion);
              return (
                <li key={emotion}>
                  <span
                    className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-transform duration-300 ease-product hover:-translate-y-0.5"
                    style={{
                      borderColor: `color-mix(in oklab, ${meta.color} 30%, transparent)`,
                      background: `color-mix(in oklab, ${meta.color} 8%, transparent)`,
                      color: meta.color,
                    }}
                  >
                    <span aria-hidden="true">{meta.emoji}</span>
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section className="container py-20" aria-labelledby="how-heading">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">How it works</p>
          <h2 id="how-heading" className="mt-3 max-w-2xl text-headline font-semibold">
            Three steps between your sentence and its emotional signature.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Type,
              step: "01",
              title: "You write",
              body: "Type or paste anything short and human. Analysis fires 400ms after you stop typing — no button, no waiting.",
            },
            {
              icon: Cpu,
              step: "02",
              title: "The model reads",
              body: `A fine-tuned DistilBERT (${formatCount(stats.parameters)} parameters) tokenises the text and produces a probability for each of the six classes.`,
            },
            {
              icon: BarChart3,
              step: "03",
              title: "You see everything",
              body: "Not just the top label — the full distribution, the runner-up, and how confident the model actually is.",
            },
          ].map((item, i) => (
            <Reveal key={item.step} delay={i * 0.08}>
              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl border border-border bg-elevated/60">
                      <item.icon className="size-4 text-body" aria-hidden="true" />
                    </span>
                    <span className="tabular text-xs text-muted">{item.step}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-body">{item.body}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- the model */}
      <section className="container py-12" aria-labelledby="model-heading">
        <Reveal>
          <Card className="overflow-hidden">
            <CardContent className="grid gap-8 p-7 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:p-10">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                  The model
                </p>
                <h2 id="model-heading" className="mt-3 text-headline font-semibold">
                  Measured, not claimed.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-body">
                  {stats.hasRealMetrics ? (
                    <>
                      Every number here comes from an evaluation run on the{" "}
                      {formatCount(stats.testRows)}-example test split, which the model never saw
                      during training or checkpoint selection.
                    </>
                  ) : (
                    <>
                      These are the numbers from the currently deployed model. Train your own with
                      the included Kaggle notebook and this section updates itself from{" "}
                      <code className="font-mono text-xs text-body">metrics.json</code>.
                    </>
                  )}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-6">
                  <Link href="/about">
                    Full metrics &amp; per-class breakdown
                    <ArrowRight />
                  </Link>
                </Button>
              </div>

              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
                {[
                  { icon: Gauge, label: "Accuracy", value: stats.accuracyLabel, note: "test split" },
                  { icon: Layers, label: "Macro F1", value: stats.f1Label, note: "all six classes" },
                  {
                    icon: Cpu,
                    label: "Baseline",
                    value: stats.baselineLabel,
                    note: "TF-IDF + logistic regression",
                  },
                  {
                    icon: BarChart3,
                    label: "Training data",
                    value: formatCount(stats.trainRows),
                    note: "labelled examples",
                  },
                ].map((cell) => (
                  <div key={cell.label} className="bg-surface p-5">
                    <dt className="flex items-center gap-2 text-xs text-muted">
                      <cell.icon className="size-3.5" aria-hidden="true" />
                      {cell.label}
                    </dt>
                    <dd>
                      <span className="tabular mt-2 block text-2xl font-semibold text-ink">
                        {cell.value}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{cell.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </Reveal>
      </section>

      {/* --------------------------------------------------------------- cta */}
      <section className="container py-16">
        <Reveal>
          <div className="glass grain relative overflow-hidden px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(60% 100% at 50% 0%, hsl(var(--accent)), transparent 70%)",
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-headline font-semibold">Try it on something you actually wrote.</h2>
              <p className="mt-4 text-base leading-relaxed text-body">
                A message you sent this week. A review you left. A line from your journal. The
                analyzer keeps a local history so you can compare them side by side.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/analyze">
                    Start analysing
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/batch">Analyse a whole file</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
