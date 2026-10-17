import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertArenaBackofficeAccess, AuthorizationError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseLoyaltyRepository } from '@/modules/loyalty/repositories/SupabaseLoyaltyRepository'
import { loyaltyPageReadSchema } from '@/modules/loyalty/lib/page-read'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

/** Independent, cancellable reads. Financial writes keep their existing atomic actions. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers })
    }
    const input = loyaltyPageReadSchema.parse(await request.json().catch(() => null))
    const access = await assertArenaBackofficeAccess(input.arenaId)
    if (input.userId !== access.dbUserId) {
      return NextResponse.json({ success: false, error: 'Sua sessão foi alterada. Entre novamente.' }, { status: 409, headers })
    }
    const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
    const data = input.kind === 'statement'
      ? await repo.getStatement(input.arenaId, input.page, 15, {
        athleteName: input.search, startDate: input.startDate, endDate: input.endDate,
      })
      : await repo.getAthletesWithBalance(input.arenaId, input.page, 10, input.search)
    return NextResponse.json({ success: true, data }, { headers })
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : error instanceof z.ZodError ? 400 : 500
    const message = status === 500 ? 'Não foi possível carregar os dados. Tente novamente.'
      : status === 400 ? 'Parâmetros inválidos para a listagem.' : (error as Error).message
    return NextResponse.json({ success: false, error: message }, { status, headers })
  }
}
