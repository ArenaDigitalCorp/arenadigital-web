import { PaymentApiError } from '@/modules/payments/errors'
import { getSubscription } from '@/modules/payments/usecases/get-subscription.usecase'
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arenaId } = await params

  const hasAccess = await verifyArenaAccess(user.id, arenaId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const subscription = await getSubscription(arenaId)
    return NextResponse.json(subscription)
  } catch (error) {
    if (error instanceof PaymentApiError) return error.toNextResponse()
    console.error('[payments] get-subscription error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
