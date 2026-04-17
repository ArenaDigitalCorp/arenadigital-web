import { stripe } from '@/lib/stripe.client'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export type PaymentHistoryItem = {
  id: string
  amountCents: number
  status: 'paid' | 'open' | 'void' | 'uncollectible' | 'draft'
  invoiceNumber: string | null
  description: string | null
  createdAt: string
}

export async function getPaymentHistory(arenaId: string): Promise<PaymentHistoryItem[]> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('arena_subscriptions')
    .select('stripe_customer_id')
    .eq('arena_id', arenaId)
    .maybeSingle()

  if (!data?.stripe_customer_id) return []

  try {
    const invoices = await stripe.invoices.list({
      customer: data.stripe_customer_id,
      limit: 50
    })

    return invoices.data.map((inv) => ({
      id: inv.id,
      amountCents: inv.amount_paid || inv.amount_due || 0,
      status: inv.status as PaymentHistoryItem['status'],
      invoiceNumber: inv.number ?? null,
      description: inv.description ?? null,
      createdAt: new Date(inv.created * 1000).toISOString()
    }))
  } catch {
    return []
  }
}
