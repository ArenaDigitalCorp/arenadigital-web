'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackScreenView } from '@/lib/telemetry/client'

export function TelemetryPageView() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname) trackScreenView(pathname)
  }, [pathname])

  return null
}
