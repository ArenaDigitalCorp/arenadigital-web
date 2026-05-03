import { getSupabaseAdmin } from '@/lib/supabase-server'
import { PaymentApiError, PaymentConfigurationError } from '@/modules/payments/errors'
import { getPaymentGateway } from '@/modules/payments/gateway'
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod'

const RequestSchema = z.object({
  arenaId: z.string().uuid(),
  card: z.object({
    holderName: z.string().min(1),
    number: z.string().min(13),
    expiryMonth: z.string().regex(/^\d{2}$/),
    expiryYear: z.string().regex(/^\d{4}$/),
    cvv: z.string().min(3).max(4),
  }),
  /** CPF/CNPJ do titular do cartão; demais dados de cobrança vêm do cliente Asaas (cadastro da arena). */
  cpfCnpj: z
    .string()
    .min(1)
    .transform((s) => s.replace(/\D/g, ''))
    .refine((d) => d.length === 11 || d.length === 14, {
      message: 'CPF/CNPJ inválido.',
    }),
})

function extractClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}

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

  const gateway = getPaymentGateway()

  if (!gateway.tokenizeCard) {
    return NextResponse.json(
      {
        error: `Provedor "${gateway.providerName}" não suporta tokenização server-side.`,
      },
      { status: 400 }
    )
  }

  if (!gateway.resolveBillingHolderForCardTokenize) {
    return NextResponse.json(
      { error: 'Provedor não suporta montagem automática dos dados do titular.' },
      { status: 400 }
    )
  }

  try {
    const { data: subscription } = await getSupabaseAdmin()
      .from('arena_subscriptions')
      .select('gateway_customer_id')
      .eq('arena_id', parsed.data.arenaId)
      .maybeSingle()

    if (!subscription?.gateway_customer_id) {
      throw new PaymentConfigurationError(
        'Customer não encontrado. Inicie o setup-intent antes.'
      )
    }

    const remoteIp = extractClientIp(request)

    const baseHolder = await gateway.resolveBillingHolderForCardTokenize(
      subscription.gateway_customer_id
    )

    const holder = { ...baseHolder, cpfCnpj: parsed.data.cpfCnpj }

    const result = await gateway.tokenizeCard({
      customerId: subscription.gateway_customer_id,
      card: parsed.data.card,
      holder,
      remoteIp,
    })

    return NextResponse.json({ token: result.token })
  } catch (error) {
    if (error instanceof PaymentApiError) return error.toNextResponse()
    console.error('[payments] tokenize-card error', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Falha ao tokenizar cartão.',
      },
      { status: 500 }
    )
  }
}
