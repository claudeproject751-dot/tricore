import { Skeleton } from "@/components/ui/skeleton";

/** Route-level skeleton. Mirrors the page shell so nothing jumps on load. */
export default function Loading() {
  return (
    <div className="container py-12">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-5 h-10 w-3/4 max-w-lg" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />
      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
