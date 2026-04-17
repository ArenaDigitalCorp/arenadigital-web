import { StripeApiError } from '@/modules/stripe/errors'
import {
  SubscribeRequestSchema,
  subscribe
} from '@/modules/stripe/usecases/subscribe.usecase'
import { verifyArenaAccess } from '@/modules/stripe/utils/verify-arena-access'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = SubscribeRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const hasAccess = await verifyArenaAccess(userId, parsed.data.arenaId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await subscribe({ ...parsed.data, actorId: userId })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof StripeApiError) return error.toNextResponse()
    console.error('[stripe] subscribe error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
