import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingModeration() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Carregando denúncias…</span>
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  )
}
