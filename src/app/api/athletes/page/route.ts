import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertArenaBackofficeAccess, AuthorizationError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { athletePageSchema, fetchAthletePage } from '@/modules/athletes/lib/athlete-page'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

const inputSchema = athletePageSchema.extend({ userId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers })
    }
    const input = inputSchema.parse(await request.json().catch(() => null))
    const access = await assertArenaBackofficeAccess(input.arenaId)
    // A stale browser context must never cache another account's response.
    if (access.dbUserId !== input.userId) {
      return NextResponse.json({ success: false, error: 'Sua sessão foi alterada. Entre novamente.' }, { status: 409, headers })
    }
    const data = await fetchAthletePage(getSupabaseAdmin(), input.arenaId, input)
    return NextResponse.json({ success: true, data }, { headers })
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : error instanceof z.ZodError ? 400 : 500
    const message = status === 500 ? 'Não foi possível carregar os atletas. Tente novamente.'
      : status === 400 ? 'Parâmetros inválidos para a listagem.' : (error as Error).message
    return NextResponse.json({ success: false, error: message }, { status, headers })
  }
}
