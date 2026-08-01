import { PaymentApiError } from '@/modules/payments/errors'
import {
  cancelSubscription,
  reactivateSubscription
} from '@/modules/payments/usecases/cancel-subscription.usecase'
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { observeHttpRequest } from '@/lib/observability/server'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod'

const RequestSchema = z.object({
  arenaId: z.string().uuid(),
  action: z.enum(['cancel', 'reactivate'])
})

export async function POST(request: NextRequest) {
  const observation = observeHttpRequest(request, {
    component: 'payments',
    operation: 'subscription_change'
  })
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return observation.respond(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await request.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return observation.respond(NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.flatten() },
      { status: 400 }
    ))
  }

  const hasAccess = await verifyArenaAccess(user.id, parsed.data.arenaId)
  if (!hasAccess) return observation.respond(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  try {
    if (parsed.data.action === 'cancel') {
      await cancelSubscription(parsed.data.arenaId, user.id)
    } else {
      await reactivateSubscription(parsed.data.arenaId, user.id)
    }

    return observation.respond(NextResponse.json({ success: true }))
  } catch (error) {
    if (error instanceof PaymentApiError) return observation.respond(error.toNextResponse())
    observation.log('error', 'payments.subscription_change.failed', { error })
    return observation.respond(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
