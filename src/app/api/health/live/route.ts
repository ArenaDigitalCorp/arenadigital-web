import { observeHttpRequest } from '@/lib/observability/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const observation = observeHttpRequest(request, {
    component: 'health',
    operation: 'liveness',
  })
  return observation.respond(NextResponse.json({ status: 'alive' }))
}

export async function HEAD(request: Request) {
  const observation = observeHttpRequest(request, {
    component: 'health',
    operation: 'liveness',
  })
  return observation.respond(new NextResponse(null, { status: 200 }))
}
