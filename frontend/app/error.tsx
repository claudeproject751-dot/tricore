"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console and in Vercel's runtime logs.
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span aria-hidden="true" className="text-5xl">
        😵‍💫
      </span>
      <h1 className="mt-6 text-headline font-semibold">Something broke on our side</h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-body">
        This page hit an unexpected error. Reloading usually clears it — nothing you analysed has
        been lost.
      </p>
      {error.digest && (
        <p className="tabular mt-3 text-xs text-muted">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
