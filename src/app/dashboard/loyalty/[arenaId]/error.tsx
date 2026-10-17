"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DashboardErrorState,
  type DashboardRouteError,
} from "@/components/dashboard/DashboardErrorState"

export default function LoyaltyError({ error, reset }: { error: DashboardRouteError; reset: () => void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  function retry() {
    // Resetting the boundary alone can replay the failed Server Component.
    // Refresh its server data and clear the boundary in the same transition.
    startTransition(() => {
      router.refresh()
      reset()
    })
  }
  return <DashboardErrorState error={error} reset={retry} title="Erro ao carregar fidelidade" logLabel="loyalty" />
}
