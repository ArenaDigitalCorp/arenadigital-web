import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
    if (request.nextUrl.pathname === '/logfire-proxy/v1/traces') {
        const token = process.env.LOGFIRE_TOKEN?.trim()
        if (!token) return new NextResponse(null, { status: 204 })

        const configuredEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim()
        const baseEndpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://logfire-api.pydantic.dev')
            .trim()
            .replace(/\/$/u, '')
        const target = configuredEndpoint || `${baseEndpoint}/v1/traces`
        const headers = new Headers(request.headers)
        headers.set('Authorization', token)

        return NextResponse.rewrite(new URL(target), {
            request: { headers },
        })
    }

    return updateSession(request)
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
