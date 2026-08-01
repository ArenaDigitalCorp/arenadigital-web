import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import { AuthorizationError, assertArenaAdminAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { logAuditEvent } from '@/modules/audit/audit-log.service'
import { MetaWhatsAppClient } from '@/modules/ai-agent/providers/whatsapp/MetaWhatsAppClient'
import { SupabaseWhatsAppChannelRepository } from '@/modules/ai-agent/repositories/SupabaseWhatsAppChannelRepository'

export const runtime = 'nodejs'

const DEFAULT_GRAPH_VERSION = 'v21.0'

// Payload enviado pelo front-end após o Embedded Signup do Meta (Facebook Login
// for Business). O SDK JS retorna `code` (para trocar por token) e os ids do
// WABA/telefone selecionados pelo gestor.
const bodySchema = z.object({
  arenaId: z.string().uuid(),
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  displayPhoneNumber: z.string().nullish(),
  verifiedName: z.string().nullish(),
})

function graphBase(): string {
  const version = process.env.META_GRAPH_API_VERSION ?? DEFAULT_GRAPH_VERSION
  return `https://graph.facebook.com/${version}`
}

/** Troca o `code` do Embedded Signup por um token de acesso do negócio. */
async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('Missing META_APP_ID or META_APP_SECRET')
  }
  const url = new URL(`${graphBase()}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('code', code)

  const response = await fetch(url, { method: 'GET' })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Meta token exchange failed ${response.status}: ${detail.slice(0, 300)}`)
  }
  const json = (await response.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Meta token exchange: missing access_token')
  return json.access_token
}

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload inválido'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const { dbUserId } = await assertArenaAdminAccess(parsed.arenaId)

    const accessToken = await exchangeCodeForToken(parsed.code)
    await new MetaWhatsAppClient().subscribeAppToWaba({ wabaId: parsed.wabaId, accessToken })

    const channel = await new SupabaseWhatsAppChannelRepository(getSupabaseAdmin()).connect({
      arenaId: parsed.arenaId,
      phoneNumberId: parsed.phoneNumberId,
      wabaId: parsed.wabaId,
      displayPhoneNumber: parsed.displayPhoneNumber ?? null,
      verifiedName: parsed.verifiedName ?? null,
      accessToken,
    })

    await logAuditEvent({
      entityType: 'arena_ai_agent',
      entityId: parsed.arenaId,
      action: 'agent.channel_connected',
      actorId: dbUserId,
      actorType: 'user',
      newValue: {
        phone_number_id: channel.phoneNumberId,
        waba_id: channel.wabaId,
        source: 'embedded_signup',
      },
    })

    return NextResponse.json({
      success: true,
      channel: {
        phoneNumberId: channel.phoneNumberId,
        displayPhoneNumber: channel.displayPhoneNumber,
        status: channel.status,
      },
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    // Never emit or log the Meta exchange response: it can contain token or
    // authorization-code context. Keep only a non-sensitive error class.
    console.error('[whatsapp-embedded-signup] request failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    })
    return NextResponse.json({ error: 'Falha ao conectar via Embedded Signup' }, { status: 500 })
  }
}
