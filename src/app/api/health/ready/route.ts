import { getSupabaseAdmin } from '@/lib/supabase-server'
import { checkDatabaseReadiness } from '@/lib/observability/health'
import { observeHttpRequest } from '@/lib/observability/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function probeDatabase() {
  const { error } = await getSupabaseAdmin().from('sports').select('id').limit(1)
  if (error) throw error
}

export async function GET(request: Request) {
  const observation = observeHttpRequest(request, {
    component: 'health',
    operation: 'readiness',
  })
  const readiness = await checkDatabaseReadiness(probeDatabase)

  if (!readiness.ready) {
    observation.log('warn', 'health.readiness.dependency_unavailable', {
      dependency: 'database',
      reason: readiness.reason,
    })
    return observation.respond(
      NextResponse.json(
        { status: 'not_ready', dependencies: { database: 'unavailable' } },
        { status: 503 },
      ),
    )
  }

  return observation.respond(
    NextResponse.json({ status: 'ready', dependencies: { database: 'ready' } }),
  )
}
