import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PaymentApiError, SubscriptionCancellationChangedError } from '@/modules/payments/errors'
import { cancelSubscription } from '@/modules/payments/usecases/cancel-subscription.usecase'
import { subscriptionWithdrawalForArena } from '@/modules/payments/usecases/subscription-withdrawal.usecase'
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access'

const input = z.object({
  arenaId: z.uuid(),
  confirmation: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
})

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

async function respond(raw: unknown, register: boolean) {
  const parsed = input.safeParse(raw)
  if (!parsed.success || (register && !parsed.data.confirmation)) {
    return reply({ error: 'Pedido de cancelamento inválido.' }, 400)
  }

  const session = await createSupabaseServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return reply({ error: 'Entre na sua conta para continuar.' }, 401)
  if (!await verifyArenaAccess(user.id, parsed.data.arenaId)) return reply({ error: 'Acesso negado.' }, 403)

  try {
    const { arenaId } = parsed.data
    const confirmation = register ? parsed.data.confirmation : null
    return reply(await subscriptionWithdrawalForArena(arenaId, user.id, confirmation ? {
      token: confirmation,
      cancelRenewal: expected => cancelSubscription(arenaId, user.id, expected),
    } : undefined), register ? 202 : 200)
  } catch (error) {
    if (error instanceof SubscriptionCancellationChangedError) {
      return reply({ error: error.message, code: error.code }, 409)
    }
    if (error instanceof PaymentApiError) return reply({ error: error.message }, error.statusCode)
    console.error('[subscription-withdrawal] could not read or register request')
    return reply({ error: 'Não foi possível acessar o pedido agora. Tente novamente.' }, 503)
  }
}

export async function GET(request: NextRequest) {
  return respond({ arenaId: request.nextUrl.searchParams.get('arenaId') }, false)
}

export async function POST(request: NextRequest) {
  return respond(await request.json().catch(() => null), true)
}
