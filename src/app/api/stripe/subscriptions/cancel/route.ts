import { StripeApiError } from '@/modules/stripe/errors'
import {
  cancelSubscription,
  reactivateSubscription
} from '@/modules/stripe/usecases/cancel-subscription.usecase'
import { verifyArenaAccess } from '@/modules/stripe/utils/verify-arena-access'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod'

const RequestSchema = z.object({
  arenaId: z.string().uuid(),
  action: z.enum(['cancel', 'reactivate'])
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const hasAccess = await verifyArenaAccess(userId, parsed.data.arenaId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    if (parsed.data.action === 'cancel') {
      await cancelSubscription(parsed.data.arenaId, userId)
    } else {
      await reactivateSubscription(parsed.data.arenaId, userId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof StripeApiError) return error.toNextResponse()
    console.error('[stripe] cancel-subscription error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
