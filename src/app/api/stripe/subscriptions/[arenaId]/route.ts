import { StripeApiError } from '@/modules/stripe/errors'
import { getSubscription } from '@/modules/stripe/usecases/get-subscription.usecase'
import { verifyArenaAccess } from '@/modules/stripe/utils/verify-arena-access'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arenaId } = await params

  const hasAccess = await verifyArenaAccess(userId, arenaId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const subscription = await getSubscription(arenaId)
    return NextResponse.json(subscription)
  } catch (error) {
    if (error instanceof StripeApiError) return error.toNextResponse()
    console.error('[stripe] get-subscription error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
