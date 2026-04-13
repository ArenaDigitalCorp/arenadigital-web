import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>

      {/* Time grid */}
      <div className="rounded-xl border overflow-hidden">
        <div className="grid grid-cols-8 border-b p-3 gap-3">
          <Skeleton className="h-4" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="grid grid-cols-8 border-b p-3 gap-3">
            <Skeleton className="h-4 w-12" />
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className={`h-10 rounded-lg ${Math.random() > 0.7 ? 'opacity-100' : 'opacity-20'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
