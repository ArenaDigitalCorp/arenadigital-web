'use client'

import { useEffect } from 'react'
import { trackClientError } from '@/lib/telemetry/client'

export function TelemetryErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackClientError('window_error', event.error)
    }
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackClientError('unhandled_rejection', event.reason)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
