import type {
  DomainInvoice,
  DomainInvoiceStatus,
  DomainPaymentMethod,
  DomainSubscription,
  DomainSubscriptionStatus,
  DomainWebhookEvent,
} from '../domain/types';
import type {
  CardCollectionContext,
  ChangeSubscriptionPlanInput,
  CreateCustomerInput,
  CreateSubscriptionInput,
  PaymentGateway,
  PaymentProvider,
  PrepareCardCollectionInput,
  RetryFailedPaymentInput,
  RetryFailedPaymentResult,
  TokenizeCardInput,
  UpdateSubscriptionPaymentMethodInput,
} from './payment-gateway.interface';
import { PaymentApiError } from '../errors';

// ===== Tipos do Asaas (apenas o que usamos) =====

type AsaasCustomer = {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
  externalReference: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  postalCode?: string | null;
  addressNumber?: string | null;
};

type AsaasCreditCard = {
  creditCardNumber: string | null;
  creditCardBrand: string | null;
  creditCardToken: string | null;
};

type AsaasSubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  cycle: string;
  value: number;
  nextDueDate: string;
  endDate: string | null;
  status: AsaasSubscriptionStatus;
  description: string | null;
  externalReference: string | null;
  deleted: boolean;
};

type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

type AsaasPayment = {
  id: string;
  customer: string;
  subscription: string | null;
  value: number;
  netValue: number | null;
  status: AsaasPaymentStatus;
  billingType: string;
  dueDate: string;
  dateCreated: string;
  invoiceNumber: string | null;
  description: string | null;
  creditCard: AsaasCreditCard | null;
  invoiceUrl: string | null;
};

type AsaasListResponse<T> = {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};

type AsaasTokenizeResponse = {
  creditCardNumber: string;
  creditCardBrand: string;
  creditCardToken: string;
};

type AsaasWebhookPayload = {
  id?: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};

// ===== Helpers =====

function getBaseUrl(): string {
  const explicit = process.env.ASAAS_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const env = (process.env.ASAAS_ENV ?? 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://api.asaas.com'
    : 'https://api-sandbox.asaas.com';
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('Missing ASAAS_API_KEY environment variable');
  return key;
}

function getWebhookToken(): string {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token)
    throw new Error('Missing ASAAS_WEBHOOK_TOKEN environment variable');
  return token;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adiciona N dias a uma data ISO yyyy-mm-dd. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function reaisToCents(value: number): number {
  return Math.round(value * 100);
}

function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

function mapSubscriptionStatus(
  s: AsaasSubscriptionStatus
): DomainSubscriptionStatus {
  switch (s) {
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'paused';
    case 'EXPIRED':
      return 'canceled';
  }
}

function mapInvoiceStatus(s: AsaasPaymentStatus): DomainInvoiceStatus {
  switch (s) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'paid';
    case 'PENDING':
    case 'OVERDUE':
    case 'AWAITING_RISK_ANALYSIS':
      return 'open';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      return 'void';
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'AWAITING_CHARGEBACK_REVERSAL':
    case 'DUNNING_REQUESTED':
    case 'DUNNING_RECEIVED':
      return 'uncollectible';
    default:
      return 'draft';
  }
}

function mapPayment(payment: AsaasPayment): DomainInvoice {
  return {
    id: payment.id,
    amountCents: reaisToCents(payment.value),
    status: mapInvoiceStatus(payment.status),
    number: payment.invoiceNumber,
    description: payment.description,
    createdAtIso: new Date(payment.dateCreated).toISOString(),
    attemptCount: 0,
  };
}

function mapPaymentMethodFromPayment(
  payment: AsaasPayment | null
): DomainPaymentMethod | null {
  if (!payment?.creditCard) return null;
  const cc = payment.creditCard;
  if (!cc.creditCardToken) return null;

  const last4 = cc.creditCardNumber?.replace(/\D/g, '').slice(-4) ?? '****';
  return {
    id: cc.creditCardToken,
    type: 'card',
    card: {
      brand: (cc.creditCardBrand ?? 'unknown').toLowerCase(),
      last4,
    },
  };
}

// ===== Cliente HTTP =====

class AsaasHttpClient {
  constructor(
    private readonly baseUrl: string = getBaseUrl(),
    private readonly apiKey: string = getApiKey()
  ) {}

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { body?: unknown; idempotencyKey?: string } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      access_token: this.apiKey,
      'User-Agent': 'arenadigital-web/1.0',
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
      const errorMessage =
        (json &&
        typeof json === 'object' &&
        'errors' in json &&
        Array.isArray((json as { errors: unknown }).errors)
          ? (json as { errors: Array<{ description?: string }> }).errors
              .map((e) => e.description ?? '')
              .join('; ')
          : null) ?? `Asaas request failed: ${res.status} ${res.statusText}`;

      const error = new Error(errorMessage) as Error & {
        status?: number;
        payload?: unknown;
      };
      error.status = res.status;
      error.payload = json;
      throw error;
    }

    return json as T;
  }
}

// ===== Gateway =====

export class AsaasGateway implements PaymentGateway {
  readonly providerName: PaymentProvider = 'asaas';
  readonly webhookSignatureHeader = 'asaas-access-token';

  constructor(private readonly http: AsaasHttpClient = new AsaasHttpClient()) {}

  async createCustomer(input: CreateCustomerInput): Promise<{ id: string }> {
    if (!input.cpfCnpj) {
      throw new Error(
        'Asaas requer cpfCnpj para criar customer. Atualize o cadastro da arena.'
      );
    }

    const externalRef = input.metadata?.arena_id;

    if (externalRef) {
      const existing = await this.findCustomerByExternalReference(externalRef);
      if (existing) {
        await this.http.request<AsaasCustomer>(
          'PUT',
          `/v3/customers/${existing.id}`,
          {
            body: {
              name: input.name ?? existing.name,
              email: input.email,
              cpfCnpj: input.cpfCnpj,
              phone: input.phone ?? undefined,
              postalCode: input.postalCode ?? undefined,
              addressNumber: input.addressNumber ?? undefined,
            },
          }
        );
        return { id: existing.id };
      }
    }

    const customer = await this.http.request<AsaasCustomer>(
      'POST',
      '/v3/customers',
      {
        body: {
          name: input.name ?? input.email,
          email: input.email,
          cpfCnpj: input.cpfCnpj,
          phone: input.phone ?? undefined,
          postalCode: input.postalCode ?? undefined,
          addressNumber: input.addressNumber ?? undefined,
          externalReference: externalRef,
        },
      }
    );

    return { id: customer.id };
  }

  async prepareCardCollection(
    input: PrepareCardCollectionInput
  ): Promise<CardCollectionContext> {
    return { provider: 'asaas', customerId: input.customerId };
  }

  async resolveBillingHolderForCardTokenize(
    customerId: string
  ): Promise<TokenizeCardInput['holder']> {
    const c = await this.http.request<AsaasCustomer>(
      'GET',
      `/v3/customers/${customerId}`
    );

    const phoneDigits = (c.phone ?? c.mobilePhone ?? '').replace(/\D/g, '');
    const postalDigits = (c.postalCode ?? '').replace(/\D/g, '');
    const email = (c.email ?? '').trim();
    const name = (c.name ?? '').trim();
    const cpfDigits = (c.cpfCnpj ?? '').replace(/\D/g, '');
    const addressNumber = (c.addressNumber ?? '').trim() || 'S/N';

    const missing: string[] = [];
    if (!name) missing.push('nome da arena');
    if (!email) missing.push('e-mail do titular (conta)');
    if (cpfDigits.length < 11) missing.push('CPF/CNPJ no cadastro da arena');
    if (postalDigits.length < 8) missing.push('CEP');
    if (phoneDigits.length < 8) missing.push('telefone');
    if (missing.length) {
      throw new PaymentApiError(
        400,
        `Complete no cadastro da arena: ${missing.join(', ')}. Depois tente cadastrar o cartão novamente.`
      );
    }

    return {
      name,
      email,
      cpfCnpj: cpfDigits,
      postalCode: postalDigits,
      addressNumber,
      phone: phoneDigits,
    };
  }

  async tokenizeCard(input: TokenizeCardInput): Promise<{ token: string }> {
    const result = await this.http.request<AsaasTokenizeResponse>(
      'POST',
      '/v3/creditCard/tokenizeCreditCard',
      {
        body: {
          customer: input.customerId,
          creditCard: {
            holderName: input.card.holderName,
            number: input.card.number,
            expiryMonth: input.card.expiryMonth,
            expiryYear: input.card.expiryYear,
            ccv: input.card.cvv,
          },
          creditCardHolderInfo: {
            name: input.holder.name,
            email: input.holder.email,
            cpfCnpj: input.holder.cpfCnpj,
            postalCode: input.holder.postalCode,
            addressNumber: input.holder.addressNumber,
            phone: input.holder.phone,
          },
          remoteIp: input.remoteIp,
        },
      }
    );
    return { token: result.creditCardToken };
  }

  async createSubscription(
    input: CreateSubscriptionInput
  ): Promise<DomainSubscription> {
    const cycle = input.plan.cycle ?? 'MONTHLY';
    const today = todayIsoDate();

    const sub = await this.http.request<AsaasSubscription>(
      'POST',
      '/v3/subscriptions',
      {
        body: {
          customer: input.customerId,
          billingType: 'CREDIT_CARD',
          value: centsToReais(input.plan.priceCents),
          nextDueDate: today,
          cycle,
          creditCardToken: input.paymentMethodId,
          description: input.plan.label,
          externalReference: input.metadata?.arena_id,
        },
        idempotencyKey: input.idempotencyKey,
      }
    );

    return this.hydrateSubscription(sub, input.paymentMethodId);
  }

  async retrieveSubscription(
    subscriptionId: string
  ): Promise<DomainSubscription | null> {
    try {
      const sub = await this.http.request<AsaasSubscription>(
        'GET',
        `/v3/subscriptions/${subscriptionId}`
      );
      return this.hydrateSubscription(sub);
    } catch {
      return null;
    }
  }

  async retrieveSubscriptionWithPaymentMethod(
    subscriptionId: string
  ): Promise<DomainSubscription | null> {
    try {
      const sub = await this.http.request<AsaasSubscription>(
        'GET',
        `/v3/subscriptions/${subscriptionId}`
      );
      return this.hydrateSubscription(sub, undefined, {
        fetchPaymentMethod: true,
      });
    } catch {
      return null;
    }
  }

  async changeSubscriptionPlan(
    input: ChangeSubscriptionPlanInput
  ): Promise<DomainSubscription> {
    const cycle = input.plan.cycle ?? 'MONTHLY';

    const sub = await this.http.request<AsaasSubscription>(
      'PUT',
      `/v3/subscriptions/${input.subscriptionId}`,
      {
        body: {
          value: centsToReais(input.plan.priceCents),
          cycle,
          description: input.plan.label,
          updatePendingPayments: true,
        },
        idempotencyKey: input.idempotencyKey,
      }
    );

    if (input.paymentMethodId) {
      await this.updateSubscriptionPaymentMethod({
        subscriptionId: input.subscriptionId,
        paymentMethodId: input.paymentMethodId,
      });
    }

    return this.hydrateSubscription(sub, input.paymentMethodId);
  }

  async updateSubscriptionPaymentMethod(
    input: UpdateSubscriptionPaymentMethodInput
  ): Promise<DomainSubscription> {
    const sub = await this.http.request<AsaasSubscription>(
      'PUT',
      `/v3/subscriptions/${input.subscriptionId}`,
      {
        body: {
          billingType: 'CREDIT_CARD',
          creditCardToken: input.paymentMethodId,
          updatePendingPayments: true,
        },
        idempotencyKey: input.idempotencyKey,
      }
    );

    return this.hydrateSubscription(sub, input.paymentMethodId);
  }

  async setSubscriptionCancelAtPeriodEnd(
    subscriptionId: string,
    cancel: boolean
  ): Promise<void> {
    if (cancel) {
      const sub = await this.http.request<AsaasSubscription>(
        'GET',
        `/v3/subscriptions/${subscriptionId}`
      );
      const endDate = sub.nextDueDate
        ? addDays(sub.nextDueDate, -1)
        : todayIsoDate();

      await this.http.request<AsaasSubscription>(
        'PUT',
        `/v3/subscriptions/${subscriptionId}`,
        { body: { endDate } }
      );
    } else {
      await this.http.request<AsaasSubscription>(
        'PUT',
        `/v3/subscriptions/${subscriptionId}`,
        { body: { endDate: null, status: 'ACTIVE' } }
      );
    }
  }

  async cancelSubscriptionImmediately(subscriptionId: string): Promise<void> {
    await this.http.request<{ deleted: boolean }>(
      'DELETE',
      `/v3/subscriptions/${subscriptionId}`
    );
  }

  async retryFailedPayment(
    input: RetryFailedPaymentInput
  ): Promise<RetryFailedPaymentResult> {
    await this.updateSubscriptionPaymentMethod({
      subscriptionId: input.subscriptionId,
      paymentMethodId: input.paymentMethodId,
    });

    const pending = await this.findPendingOrOverduePayment(
      input.subscriptionId
    );
    if (!pending) {
      return { paid: false, status: 'no_pending_payment' };
    }

    try {
      const result = await this.http.request<AsaasPayment>(
        'POST',
        `/v3/payments/${pending.id}/payWithCreditCard`,
        {
          body: { creditCardToken: input.paymentMethodId },
        }
      );
      const paid =
        result.status === 'CONFIRMED' ||
        result.status === 'RECEIVED' ||
        result.status === 'RECEIVED_IN_CASH';
      return { paid, status: result.status };
    } catch (error) {
      return {
        paid: false,
        status: error instanceof Error ? error.message : 'failed',
      };
    }
  }

  async listCustomerInvoices(
    customerId: string,
    limit = 50
  ): Promise<DomainInvoice[]> {
    try {
      const result = await this.http.request<AsaasListResponse<AsaasPayment>>(
        'GET',
        `/v3/payments?customer=${encodeURIComponent(customerId)}&limit=${limit}`
      );
      return result.data.map(mapPayment);
    } catch {
      return [];
    }
  }

  async verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): Promise<DomainWebhookEvent> {
    if (signature !== getWebhookToken()) {
      throw new Error('Invalid Asaas webhook token');
    }

    const payload = JSON.parse(rawBody) as AsaasWebhookPayload;
    const eventId = payload.id ?? `${payload.event}_${Date.now()}`;

    if (payload.payment) {
      const subscriptionId = payload.payment.subscription;

      switch (payload.event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
          return {
            kind: 'invoice.paid',
            providerEventId: eventId,
            invoice: mapPayment(payload.payment),
            subscriptionId,
          };
        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
          return {
            kind: 'invoice.payment_failed',
            providerEventId: eventId,
            invoice: mapPayment(payload.payment),
            subscriptionId,
          };
        case 'PAYMENT_AWAITING_RISK_ANALYSIS':
          return {
            kind: 'invoice.action_required',
            providerEventId: eventId,
            invoice: mapPayment(payload.payment),
            subscriptionId,
          };
        default:
          return {
            kind: 'unhandled',
            providerEventId: eventId,
            eventType: payload.event,
          };
      }
    }

    if (payload.subscription) {
      const sub = payload.subscription;
      switch (payload.event) {
        case 'SUBSCRIPTION_CREATED':
        case 'SUBSCRIPTION_UPDATED': {
          const hydrated = await this.hydrateSubscription(sub);
          return {
            kind: 'subscription.updated',
            providerEventId: eventId,
            subscription: hydrated,
          };
        }
        case 'SUBSCRIPTION_INACTIVATED':
        case 'SUBSCRIPTION_DELETED': {
          const hydrated = await this.hydrateSubscription({
            ...sub,
            status: 'EXPIRED',
          });
          return {
            kind: 'subscription.deleted',
            providerEventId: eventId,
            subscription: hydrated,
          };
        }
        default:
          return {
            kind: 'unhandled',
            providerEventId: eventId,
            eventType: payload.event,
          };
      }
    }

    return {
      kind: 'unhandled',
      providerEventId: eventId,
      eventType: payload.event,
    };
  }

  // ===== Helpers internos =====

  private async findCustomerByExternalReference(
    externalRef: string
  ): Promise<AsaasCustomer | null> {
    const result = await this.http.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/v3/customers?externalReference=${encodeURIComponent(externalRef)}&limit=1`
    );
    return result.data[0] ?? null;
  }

  private async findPendingOrOverduePayment(
    subscriptionId: string
  ): Promise<AsaasPayment | null> {
    const result = await this.http.request<AsaasListResponse<AsaasPayment>>(
      'GET',
      `/v3/subscriptions/${subscriptionId}/payments?status=PENDING&limit=1`
    );
    if (result.data[0]) return result.data[0];

    const overdue = await this.http.request<AsaasListResponse<AsaasPayment>>(
      'GET',
      `/v3/subscriptions/${subscriptionId}/payments?status=OVERDUE&limit=1`
    );
    return overdue.data[0] ?? null;
  }

  private async hydrateSubscription(
    sub: AsaasSubscription,
    knownPaymentMethodToken?: string,
    options: { fetchPaymentMethod?: boolean } = {}
  ): Promise<DomainSubscription> {
    let paymentMethod: DomainPaymentMethod | null = null;
    let latestPayment: AsaasPayment | null = null;
    let derivedStatus: DomainSubscriptionStatus = mapSubscriptionStatus(
      sub.status
    );

    if (options.fetchPaymentMethod || knownPaymentMethodToken) {
      try {
        const list = await this.http.request<AsaasListResponse<AsaasPayment>>(
          'GET',
          `/v3/subscriptions/${sub.id}/payments?limit=10`
        );
        latestPayment = list.data[0] ?? null;
        paymentMethod = mapPaymentMethodFromPayment(latestPayment);
      } catch {
        // tolerable: payment-method enrichment is best-effort
      }
    }

    if (knownPaymentMethodToken && !paymentMethod) {
      paymentMethod = {
        id: knownPaymentMethodToken,
        type: 'card',
        card: null,
      };
    }

    if (sub.status === 'ACTIVE' && latestPayment) {
      if (
        latestPayment.status === 'OVERDUE' ||
        latestPayment.status === 'DUNNING_REQUESTED' ||
        latestPayment.status === 'DUNNING_RECEIVED'
      ) {
        derivedStatus = 'past_due';
      } else if (latestPayment.status === 'PENDING') {
        derivedStatus = 'incomplete';
      } else if (latestPayment.status === 'AWAITING_RISK_ANALYSIS') {
        derivedStatus = 'incomplete';
      }
    }

    const cancelAtPeriodEnd = Boolean(sub.endDate);

    return {
      id: sub.id,
      customerId: sub.customer,
      status: derivedStatus,
      cancelAtPeriodEnd,
      canceledAtIso: sub.endDate ? `${sub.endDate}T00:00:00Z` : null,
      metadata: sub.externalReference
        ? { arena_id: sub.externalReference }
        : {},
      primaryItem: {
        id: sub.id,
        priceId: '',
        currentPeriodEndIso: sub.nextDueDate
          ? `${sub.nextDueDate}T00:00:00Z`
          : null,
      },
      paymentMethod,
      latestInvoice: latestPayment
        ? {
            id: latestPayment.id,
            requiresActionClientSecret: null,
            requiresPaymentMethod:
              latestPayment.status === 'OVERDUE' ||
              latestPayment.status === 'PENDING',
          }
        : null,
    };
  }
}
