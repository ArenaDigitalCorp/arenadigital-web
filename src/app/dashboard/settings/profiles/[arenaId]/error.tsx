"use client"

import {
  DashboardErrorState,
  type DashboardRouteError,
} from "@/components/dashboard/DashboardErrorState"

export default function Error({ error, reset }: { error: DashboardRouteError; reset: () => void }) {
  return <DashboardErrorState error={error} reset={reset} />
}
