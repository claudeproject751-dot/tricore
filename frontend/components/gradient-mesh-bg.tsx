"use client";

import { cn } from "@/lib/utils";

/**
 * The product's ambient background: three slowly drifting colour fields over a
 * near-black canvas, plus an optional hairline grid.
 *
 * `tint` lets a page bias the mesh toward the currently dominant emotion — the
 * background reacts to the model's output rather than being pure decoration.
 */
export function GradientMeshBg({
  tint,
  grid = true,
  className,
}: {
  tint?: string;
  grid?: boolean;
  className?: string;
}) {
  const accent = tint ?? "hsl(var(--accent))";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
    >
      {/* Base wash: keeps the canvas off flat black. */}
      <div className="absolute inset-0 bg-canvas" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,hsl(var(--surface))_0%,hsl(var(--canvas))_60%)]" />

      {/* Drifting colour fields. Transform-only animation, so it stays on the compositor. */}
      <div
        className="absolute -top-[22rem] left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 animate-drift rounded-full blur-[120px] transition-[background] duration-1000 ease-product"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 68%)`, opacity: 0.24 }}
      />
      <div
        className="absolute -left-40 top-1/3 h-[34rem] w-[34rem] animate-drift rounded-full blur-[130px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--sadness)), transparent 70%)",
          opacity: 0.14,
          animationDelay: "-6s",
        }}
      />
      <div
        className="absolute -right-40 bottom-0 h-[32rem] w-[32rem] animate-drift rounded-full blur-[130px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--love)), transparent 70%)",
          opacity: 0.12,
          animationDelay: "-12s",
        }}
      />

      {grid && <div className="hairline-grid absolute inset-0 opacity-40" />}

      {/* Vignette so content edges stay anchored. */}
      <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,transparent_45%,hsl(var(--canvas))_100%)]" />
    </div>
  );
}
