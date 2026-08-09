import Link from "next/link";

import { GradientMeshBg } from "@/components/gradient-mesh-bg";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <GradientMeshBg />
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <span aria-hidden="true" className="text-5xl">
          🫥
        </span>
        <h1 className="mt-6 text-headline font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-body">
          The link may be out of date. The analyzer, batch mode and the model card are all still
          where you left them.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/analyze">Open the analyzer</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
