import { PaymentApiError } from '@/modules/payments/errors'
import {
  SubscribeRequestSchema,
  subscribe
} from '@/modules/payments/usecases/subscribe.usecase'
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function extractClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = SubscribeRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const hasAccess = await verifyArenaAccess(user.id, parsed.data.arenaId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await subscribe({
      ...parsed.data,
      actorId: user.id,
      remoteIp: extractClientIp(request)
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaymentApiError) return error.toNextResponse()
    console.error('[payments] subscribe error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
