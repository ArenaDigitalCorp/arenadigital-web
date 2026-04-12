import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { WebhookEvent } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { UserService } from '@/modules/users/services/userService'

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[clerk-webhook] Missing CLERK_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(webhookSecret)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const d = event.data
    const email = d.email_addresses?.[0]?.email_address ?? ''
    const name = [d.first_name, d.last_name].filter(Boolean).join(' ')
    const metadata = (d.unsafe_metadata ?? {}) as Record<string, unknown>

    await UserService.syncUser(
      d.id,
      email,
      name,
      metadata?.arenaName as string | undefined,
      metadata?.cpf as string | undefined,
      metadata?.phone as string | undefined,
      metadata?.addressData,
    )
  }

  if (event.type === 'user.updated') {
    const d = event.data
    const email = d.email_addresses?.[0]?.email_address ?? ''
    const name = [d.first_name, d.last_name].filter(Boolean).join(' ')

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('users')
      .update({ email, name })
      .eq('clerk_user_id', d.id)

    if (error) {
      console.error('[clerk-webhook] user.updated failed', error)
      throw error
    }
  }

  return NextResponse.json({ received: true })
}
