import { cn } from "@/lib/utils";

/**
 * Skeletons, not spinners: they preserve layout so nothing jumps when the real
 * content lands, and they communicate *what* is coming.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden="true" {...props} />;
}

export function SkeletonBars({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton
            className="h-2 rounded-full"
            style={{ width: `${88 - i * 12}%` }}
          />
        </div>
      ))}
    </div>
  );
}
