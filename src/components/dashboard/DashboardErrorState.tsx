"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { trackClientError } from "@/lib/telemetry/client"

export type DashboardRouteError = Error & { digest?: string }

export interface DashboardErrorStateProps {
  error: DashboardRouteError
  reset: () => void
  title?: string
  fallbackMessage?: string
  logLabel?: string
  className?: string
  iconClassName?: string
  titleClassName?: string
  messageClassName?: string
}

export function DashboardErrorState({
  error,
  reset,
  title = "Algo deu errado",
  fallbackMessage = "Tente novamente em instantes.",
  logLabel,
  className,
  iconClassName,
  titleClassName,
  messageClassName,
}: DashboardErrorStateProps) {
  useEffect(() => {
    if (logLabel) {
      console.error(`[${logLabel}]`, error)
      trackClientError(logLabel, error)
      return
    }

    console.error(error)
    trackClientError("dashboard_error_boundary", error)
  }, [error, logLabel])

  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8",
        className
      )}
    >
      <AlertCircle className={cn("h-10 w-10 text-destructive", iconClassName)} />
      <div className="space-y-1 text-center">
        <h2 className={cn("text-lg font-semibold text-arena-navy-800", titleClassName)}>
          {title}
        </h2>
        <p className={cn("text-sm text-muted-foreground", messageClassName)}>
          {error.message || fallbackMessage}
        </p>
      </div>
      <Button
        onClick={reset}
        className="bg-arena-button text-white hover:bg-arena-button-hover"
      >
        Tentar novamente
      </Button>
    </div>
  )
}
