import { getSupabaseAdmin } from '@/lib/supabase-server'
import { AsaasGateway } from '@/modules/payments/gateway/asaas.gateway'
import { getPaymentGateway } from '@/modules/payments/gateway'

/**
 * Persiste `billing_snapshot` em `arena_subscriptions` a partir do Asaas
 * (GET assinatura + cobranças — ver doc oficial).
 * Stripe: no-op.
 */
export async function syncArenaBillingSnapshotFromGateway(
  arenaId: string
): Promise<void> {
  const gateway = getPaymentGateway()
  if (!(gateway instanceof AsaasGateway)) return

  const supabase = getSupabaseAdmin()
  const { data: row } = await supabase
    .from('arena_subscriptions')
    .select('gateway_subscription_id')
    .eq('arena_id', arenaId)
    .maybeSingle()

  const subId = row?.gateway_subscription_id
  if (!subId || typeof subId !== 'string' || subId.trim().startsWith('{')) return

  const snapshot = await gateway.buildBillingSnapshotForSubscription(subId.trim())
  if (!snapshot) return

  const { error } = await supabase
    .from('arena_subscriptions')
    .update({
      billing_snapshot: snapshot,
      updated_at: new Date().toISOString(),
    })
    .eq('arena_id', arenaId)
    .eq('gateway_subscription_id', subId)

  if (error) {
    console.error('[payments] syncArenaBillingSnapshotFromGateway failed', {
      arenaId,
      error,
    })
  }
}
