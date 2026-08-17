'use client'

import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import * as logfire from '@pydantic/logfire-browser'
import { useEffect } from 'react'

export function ClientInstrumentation() {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_LOGFIRE_ENABLED !== 'true') return

        const shutdown = logfire.configure({
            traceUrl: '/logfire-proxy/v1/traces',
            serviceName: 'arenadigital-web-browser',
            serviceVersion: process.env.NEXT_PUBLIC_APP_VERSION,
            environment: process.env.NEXT_PUBLIC_LOGFIRE_ENVIRONMENT,
            instrumentations: [getWebAutoInstrumentations()],
            rum: { session: true },
        })

        return () => {
            void shutdown()
        }
    }, [])

    return null
}
