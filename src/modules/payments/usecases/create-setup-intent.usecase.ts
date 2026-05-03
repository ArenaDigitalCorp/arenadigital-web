import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logAuditEvent } from '@/modules/audit/audit-log.service';
import {
  InvalidPlanKeyError,
  PaymentConfigurationError,
} from '@/modules/payments/errors';
import { getPaymentGateway } from '@/modules/payments/gateway';
import type {
  CardCollectionContext,
  PaymentProvider,
} from '@/modules/payments/gateway/payment-gateway.interface';
import {
  planKeySchema,
  resolveCheckoutPlanKey,
  type PlanKey,
} from '@/modules/payments/plans';
import { fetchPlanByKey } from '@/modules/payments/repositories/subscription-plans.repository';

export type CreateSetupIntentResponse = {
  provider: PaymentProvider;
  cardCollection: CardCollectionContext;
  customerId: string;
  planKey: PlanKey;
  planLabel: string;
  priceCents: number;
};

type ArenaContact = {
  name?: string | null;
  cpfCnpj?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  addressNumber?: string | null;
};

export async function createSetupIntent(
  arenaId: string,
  selectedPlanKey: PlanKey,
  ownerEmail: string,
  ownerName?: string | null,
  actorId?: string | null
): Promise<CreateSetupIntentResponse> {
  const supabase = getSupabaseAdmin();
  const gateway = getPaymentGateway();

  const parsedPlanKey = planKeySchema.safeParse(selectedPlanKey);
  if (!parsedPlanKey.success) throw new InvalidPlanKeyError();
  const planKey = resolveCheckoutPlanKey(parsedPlanKey.data);

  const plan = await fetchPlanByKey(planKey);
  if (!plan) throw new InvalidPlanKeyError();

  if (gateway.providerName === 'stripe' && !plan.gateway_price_id) {
    throw new PaymentConfigurationError(
      `Stripe price_id não configurado para o plano "${planKey}".`
    );
  }

  const arenaContact = await fetchArenaContact(arenaId);
  if (gateway.providerName === 'asaas' && !arenaContact.cpfCnpj) {
    throw new PaymentConfigurationError(
      'CPF/CNPJ é obrigatório para usar o Asaas. Atualize o cadastro da arena.'
    );
  }

  const { data: subscription } = await supabase
    .from('arena_subscriptions')
    .select('gateway_customer_id, status')
    .eq('arena_id', arenaId)
    .maybeSingle();

  let gatewayCustomerId: string | null =
    subscription?.gateway_customer_id ?? null;

  if (!gatewayCustomerId) {
    const customer = await gateway.createCustomer({
      email: ownerEmail,
      name: ownerName ?? arenaContact.name,
      cpfCnpj: arenaContact.cpfCnpj,
      phone: arenaContact.phone,
      postalCode: arenaContact.postalCode,
      addressNumber: arenaContact.addressNumber,
      metadata: { arena_id: arenaId },
    });
    gatewayCustomerId = customer.id;
  }

  const { error: upsertError } = await supabase
    .from('arena_subscriptions')
    .upsert(
      {
        arena_id: arenaId,
        gateway_customer_id: gatewayCustomerId,
        plan_key: planKey,
        plan_id: plan.id,
        status: subscription?.status ?? 'incomplete',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'arena_id' }
    );

  if (upsertError) {
    console.error('[payments] create-setup-intent — DB upsert failed', {
      customerId: gatewayCustomerId,
      error: upsertError,
    });
    throw new PaymentConfigurationError(upsertError.message);
  }

  await logAuditEvent({
    entityType: 'arena_subscription',
    entityId: arenaId,
    action: 'subscription.setup_intent_created',
    actorId: actorId ?? ownerEmail,
    actorType: 'user',
    newValue: {
      plan_key: planKey,
      plan_id: plan.id,
      gateway_customer_id: gatewayCustomerId,
      provider: gateway.providerName,
    },
    metadata: {
      arena_id: arenaId,
      reused_customer: Boolean(subscription?.gateway_customer_id),
    },
  });

  const cardCollection = await gateway.prepareCardCollection({
    customerId: gatewayCustomerId,
    metadata: { arena_id: arenaId, plan_key: planKey },
    idempotencyKey: `setup-intent-${arenaId}-${planKey}`,
  });

  return {
    provider: gateway.providerName,
    cardCollection,
    customerId: gatewayCustomerId,
    planKey,
    planLabel: plan.label,
    priceCents: plan.price_cents,
  };
}

async function fetchArenaContact(arenaId: string): Promise<ArenaContact> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('arenas')
    .select('name, cpf_cnpj, phone, zip_code, number')
    .eq('id', arenaId)
    .maybeSingle();

  if (!data) return {};

  return {
    name: data.name,
    cpfCnpj: data.cpf_cnpj,
    phone: data.phone,
    postalCode: data.zip_code,
    addressNumber: data.number,
  };
}
