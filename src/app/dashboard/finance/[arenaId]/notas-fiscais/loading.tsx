import { Skeleton } from '@/components/ui/skeleton'

export default function BookingFiscalInvoicesLoading() {
  return (
    <section aria-busy="true" aria-label="Carregando notas fiscais" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-80" />
      </div>
      <div className="divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex justify-between gap-5 px-5 py-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  )
}
