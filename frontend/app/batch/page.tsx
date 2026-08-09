import type { Metadata } from "next";

import { BatchWorkspace } from "@/components/batch-workspace";
import { GradientMeshBg } from "@/components/gradient-mesh-bg";

export const metadata: Metadata = {
  title: "Batch analysis",
  description:
    "Analyse up to 200 lines or a CSV at once, get the aggregate emotion distribution and export the results.",
};

export default function BatchPage() {
  return (
    <>
      <GradientMeshBg grid={false} />
      <div className="container py-8 sm:py-12">
        <header className="mb-7 max-w-2xl">
          <h1 className="text-headline font-semibold">Batch analysis</h1>
          <p className="mt-2.5 text-base leading-relaxed text-body">
            Feed in a chat export, a column of reviews, or a week of journal entries. One request,
            every row scored, plus the distribution across the whole set.
          </p>
        </header>

        <BatchWorkspace />
      </div>
    </>
  );
}
