import { StripeApiError } from '@/modules/stripe/errors'
import { createSetupIntent } from '@/modules/stripe/usecases/create-setup-intent.usecase'
import { verifyArenaAccess } from '@/modules/stripe/utils/verify-arena-access'
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod'
import { planKeySchema } from '@/modules/stripe/stripe-plans'

const RequestSchema = z.object({
  arenaId: z.string().uuid(),
  planKey: planKeySchema
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
    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress ?? ''
    const name = user?.fullName ?? null

    const result = await createSetupIntent(
      parsed.data.arenaId,
      parsed.data.planKey,
      email,
      name,
      userId
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof StripeApiError) return error.toNextResponse()
    console.error('[stripe] setup-intent error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
