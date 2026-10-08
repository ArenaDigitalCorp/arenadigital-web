import { Skeleton } from '@/components/ui/skeleton'

export default function TurmasLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <div className="flex gap-8 border-b border-arena-navy-800/10 pb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="space-y-4 rounded-lg border border-slate-100 bg-white p-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-56" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
