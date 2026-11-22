import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logAuditEvent } from '@/modules/audit/audit-log.service';
import {
  ExperimentalPlanAlreadyUsedError,
  InvalidPlanKeyError,
  PaymentApiError,
  PaymentConfigurationError,
} from '@/modules/payments/errors';
import { getPaymentGateway } from '@/modules/payments/gateway';
import type {
  CardCollectionContext,
  PaymentProvider,
  SubscriptionPlanInfo,
} from '@/modules/payments/gateway/payment-gateway.interface';
import {
  EXPERIMENTAL_PLAN_KEY,
  PARTNER_PLAN_KEY,
  planKeySchema,
  resolveCheckoutPlanKey,
  userSelectablePlanKeySchema,
  type PlanKey,
} from '@/modules/payments/plans';
import {
  fetchPlanByKey,
  type SubscriptionPlanRow,
} from '@/modules/payments/repositories/subscription-plans.repository';

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

function toPlanInfo(plan: SubscriptionPlanRow): SubscriptionPlanInfo {
  return {
    key: plan.key,
    label: plan.label,
    priceCents: plan.price_cents,
    gatewayPriceId: plan.gateway_price_id,
  };
}

function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return 'http://localhost:3000';
}

/** URL de retorno após checkout Asaas (rota real do app + query `status`). */
function buildSubscriptionCheckoutReturnUrl(
  baseUrl: string,
  arenaId: string,
  status: 'success' | 'canceled' | 'expired',
  operationId?: string,
): string {
  const path = `/dashboard/settings/subscription/${arenaId}/checkout-return`;
  const url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`);
  url.searchParams.set('status', status);
  if (operationId) url.searchParams.set('checkoutOperation', operationId);
  return url.toString();
}

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

  const { data: subscription, error: subscriptionError } = await supabase
    .from('arena_subscriptions')
    .select('gateway_customer_id, gateway_subscription_id, status, plan_key, experimental_started_at')
    .eq('arena_id', arenaId)
    .maybeSingle();

  if (subscriptionError) throw new PaymentConfigurationError(subscriptionError.message);

  const requestedPlanKey = parsedPlanKey.data;
  const isSelectablePlan = userSelectablePlanKeySchema.safeParse(requestedPlanKey).success;
  if (
    requestedPlanKey === EXPERIMENTAL_PLAN_KEY &&
    subscription?.plan_key &&
    subscription.plan_key !== EXPERIMENTAL_PLAN_KEY
  ) {
    throw new ExperimentalPlanAlreadyUsedError();
  }

  if (
    !isSelectablePlan &&
    (requestedPlanKey !== PARTNER_PLAN_KEY ||
      subscription?.plan_key !== PARTNER_PLAN_KEY)
  ) {
    throw new InvalidPlanKeyError();
  }

  const planKey = resolveCheckoutPlanKey(requestedPlanKey);
  const plan = await fetchPlanByKey(planKey);
  if (!plan) throw new InvalidPlanKeyError();

  if (
    gateway.providerName === 'stripe' &&
    plan.key !== EXPERIMENTAL_PLAN_KEY &&
    !plan.gateway_price_id
  ) {
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

  if (
    plan.key === EXPERIMENTAL_PLAN_KEY &&
    subscription?.experimental_started_at
  ) {
    throw new ExperimentalPlanAlreadyUsedError();
  }

  const baseUrl = getAppBaseUrl();
  const createCustomer = () => gateway.createCustomer({
    email: ownerEmail,
    name: ownerName ?? arenaContact.name,
    cpfCnpj: arenaContact.cpfCnpj,
    phone: arenaContact.phone,
    postalCode: arenaContact.postalCode,
    addressNumber: arenaContact.addressNumber,
    metadata: { arena_id: arenaId },
  });
  const collectCard = (customerId: string, operationId?: string) => gateway.prepareCardCollection({
    customerId,
    arenaId,
    plan: toPlanInfo(plan),
    successUrl: buildSubscriptionCheckoutReturnUrl(baseUrl, arenaId, 'success', operationId),
    cancelUrl: buildSubscriptionCheckoutReturnUrl(baseUrl, arenaId, 'canceled', operationId),
    expiredUrl: buildSubscriptionCheckoutReturnUrl(baseUrl, arenaId, 'expired', operationId),
    metadata: { arena_id: arenaId, plan_key: planKey },
    idempotencyKey: operationId ?? `setup-intent-${arenaId}-${planKey}-${Date.now()}`,
  });

  let gatewayCustomerId: string;
  let cardCollection: CardCollectionContext;
  if (gateway.providerName === 'asaas') {
    if (!baseUrl.toLowerCase().startsWith('https://')) {
      throw new PaymentConfigurationError(
        'O Asaas exige URLs de retorno em HTTPS. Configure NEXT_PUBLIC_APP_URL (ou APP_URL) com o endereço público do painel.'
      );
    }

    const { data, error } = await supabase.rpc('claim_asaas_subscription_checkout', {
      p_arena_id: arenaId,
      p_plan_key: planKey,
      p_plan_id: plan.id,
      p_created_by: actorId ?? null,
    });
    if (error) throw new PaymentConfigurationError(error.message);
    const claim = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

    if (claim.state === 'ready'
      && typeof claim.checkout_id === 'string'
      && typeof claim.checkout_url === 'string'
      && typeof claim.gateway_customer_id === 'string') {
      return {
        provider: 'asaas',
        cardCollection: {
          provider: 'asaas-checkout',
          checkoutId: claim.checkout_id,
          checkoutUrl: claim.checkout_url,
        },
        customerId: claim.gateway_customer_id,
        planKey,
        planLabel: plan.label,
        priceCents: plan.price_cents,
      };
    }
    if (claim.state === 'different_plan') {
      throw new PaymentApiError(409, 'Já existe um checkout de outro plano. Cancele a sessão anterior ou aguarde o encerramento antes de trocar de plano.');
    }
    if (claim.state === 'pending') {
      throw new PaymentApiError(409, 'Já existe um checkout em processamento. Aguarde a confirmação do Asaas antes de tentar novamente.');
    }
    if (claim.state !== 'claimed' || typeof claim.operation_id !== 'string') {
      throw new PaymentConfigurationError('Resposta inválida ao reservar checkout.');
    }

    const operationId = claim.operation_id;
    const abandon = async (definitiveRejection: boolean) => {
      const { error: abandonError } = await supabase.rpc('abandon_asaas_subscription_checkout', {
        p_operation_id: operationId,
        p_definitive_rejection: definitiveRejection,
      });
      if (abandonError) throw new PaymentConfigurationError(abandonError.message);
    };

    try {
      gatewayCustomerId = (await createCustomer()).id;
      const { data: started, error: startError } = await supabase.rpc('start_asaas_subscription_checkout', {
        p_operation_id: operationId,
        p_gateway_customer_id: gatewayCustomerId,
      });
      if (startError) throw new PaymentConfigurationError(startError.message);
      if (!started) throw new PaymentApiError(409, 'A sessão mudou durante a abertura do checkout. Tente novamente.');
    } catch (preparationError) {
      await abandon(false);
      throw preparationError;
    }

    try {
      cardCollection = await collectCard(gatewayCustomerId, operationId);
    } catch (checkoutError) {
      // These responses document a rejected creation. Timeouts, unrecognized
      // responses and 5xx leave the operation reserved for reconciliation.
      if (checkoutError instanceof PaymentApiError && [400, 401].includes(checkoutError.statusCode)) {
        await abandon(true);
      }
      throw checkoutError;
    }

    if (cardCollection.provider !== 'asaas-checkout') {
      throw new PaymentConfigurationError('Resposta inválida do checkout Asaas.');
    }
    const { data: attached, error: attachError } = await supabase.rpc('attach_asaas_subscription_checkout', {
      p_operation_id: operationId,
      p_checkout_id: cardCollection.checkoutId,
      p_gateway_customer_id: gatewayCustomerId,
      p_checkout_url: cardCollection.checkoutUrl,
    });
    if (attachError) throw new PaymentConfigurationError(attachError.message);
    if (!attached) throw new PaymentConfigurationError('O checkout criado ainda precisa ser conciliado.');
  } else {
    gatewayCustomerId = subscription?.gateway_customer_id ?? (await createCustomer()).id;
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
    if (upsertError) throw new PaymentConfigurationError(upsertError.message);
    cardCollection = await collectCard(gatewayCustomerId);
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
