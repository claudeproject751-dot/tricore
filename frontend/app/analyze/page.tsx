import type { Metadata } from "next";

import { Analyzer } from "@/components/analyzer";
import { GradientMeshBg } from "@/components/gradient-mesh-bg";

export const metadata: Metadata = {
  title: "Analyzer",
  description:
    "Analyse any sentence across six emotions with a live confidence breakdown, radar chart and session history.",
};

export default function AnalyzePage() {
  return (
    <>
      <GradientMeshBg grid={false} />
      <div className="container py-8 sm:py-12">
        <header className="mb-7 max-w-2xl">
          <h1 className="text-headline font-semibold">Analyzer</h1>
          <p className="mt-2.5 text-base leading-relaxed text-body">
            Write or paste text and watch the model reconsider it as you type. Every result is scored
            across all six classes and kept in this browser only.
          </p>
        </header>

        <Analyzer />
      </div>
    </>
  );
}
