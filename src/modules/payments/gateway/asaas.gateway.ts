import { createHash } from 'crypto';
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
  PaymentGateway,
  PaymentProvider,
  PrepareCardCollectionInput,
  RetryFailedPaymentInput,
  RetryFailedPaymentResult,
  UpdateSubscriptionPaymentMethodInput,
} from './payment-gateway.interface';
import type { SubscriptionBillingSnapshotV1 } from '../domain/billing-snapshot';
import { PaymentApiError } from '../errors';

// ===== Tipos do Asaas (apenas o que usamos) =====

function normalizeIdempotencyKey(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

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
  billingType:
    | 'BOLETO'
    | 'CREDIT_CARD'
    | 'PIX'
    | 'UNDEFINED'
    | 'DEBIT_CARD'
    | 'TRANSFER'
    | 'DEPOSIT';
  cycle: string;
  value: number;
  nextDueDate: string;
  endDate: string | null;
  status: AsaasSubscriptionStatus;
  description: string | null;
  externalReference: string | null;
  deleted: boolean;
  dateCreated?: string;
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
  /** Data de liquidação (doc cobrança GET). */
  paymentDate?: string | null;
  invoiceNumber: string | null;
  description: string | null;
  creditCard: AsaasCreditCard | null;
  invoiceUrl: string | null;
  installment?: string | null;
  installmentNumber?: number | null;
};

type AsaasListResponse<T> = {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};

type AsaasCheckoutResponse = {
  id: string;
  /** URL hospedada para onde redirecionar o cliente. */
  link?: string;
  /** Em algumas versões a API expõe a URL como `url`. */
  url?: string;
};

/** No webhook, `checkout.subscription` costuma ser este objeto — não o id da assinatura. */
type AsaasCheckoutSubscriptionSnapshot = {
  cycle?: string;
  nextDueDate?: string;
  endDate?: string | null;
};

type AsaasCheckoutPayload = {
  id?: string;
  status?: string;
  subscription?: string | AsaasCheckoutSubscriptionSnapshot | null;
  customer?: string | null;
  externalReference?: string | null;
};

type AsaasWebhookPayload = {
  id?: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
  checkout?: AsaasCheckoutPayload;
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

/** Webhook CHECKOUT_PAID: `subscription` pode ser string (id) ou objeto de configuração. */
function parseAsaasSubscriptionIdFromCheckoutWebhookField(
  subscription: AsaasCheckoutPayload['subscription']
): string | null {
  if (typeof subscription !== 'string') return null;
  const id = subscription.trim();
  if (!id || id.startsWith('{')) return null;
  return id;
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
    const bodyText =
      options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      access_token: this.apiKey,
      'User-Agent': 'arenadigital-web/1.0',
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const normalizedIdempotencyKey = options.idempotencyKey
      ? normalizeIdempotencyKey(options.idempotencyKey)
      : undefined;

    if (normalizedIdempotencyKey) {
      headers['idempotency-key'] = normalizedIdempotencyKey;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: bodyText,
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
          ? (
              json as {
                errors: Array<{ description?: string; message?: string }>;
              }
            ).errors
              .map((e) => e.description ?? e.message ?? '')
              .filter(Boolean)
              .join('; ')
          : null) ?? `Asaas request failed: ${res.status} ${res.statusText}`;

      throw new PaymentApiError(res.status, errorMessage, JSON.stringify(json));
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
    const cycle = input.plan.cycle ?? 'MONTHLY';
    const today = todayIsoDate();

    // O Asaas exige uma data de fim do checkout (não da subscription).
    // 24h é suficiente — se expirar, geramos outro.
    const expiresAt = addDays(today, 1);

    const checkout = await this.http.request<AsaasCheckoutResponse>(
      'POST',
      '/v3/checkouts',
      {
        body: {
          billingTypes: ['CREDIT_CARD'],
          chargeTypes: ['RECURRENT'],
          minutesToExpire: 60 * 24,
          callback: {
            successUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
            expiredUrl: input.expiredUrl,
          },
          customer: input.customerId,
          subscription: {
            cycle,
            nextDueDate: today,
          },
          items: [
            {
              name: input.plan.label,
              description: `Assinatura ${input.plan.label}`,
              quantity: 1,
              value: centsToReais(input.plan.priceCents),
            },
          ],
          externalReference: input.arenaId,
          expiresAt,
        },
        idempotencyKey: input.idempotencyKey,
      }
    );

    const checkoutUrl = checkout.link ?? checkout.url;
    if (!checkoutUrl) {
      throw new PaymentApiError(
        500,
        'Asaas retornou checkout sem URL hospedada.',
        JSON.stringify(checkout)
      );
    }

    return {
      provider: 'asaas-checkout',
      checkoutId: checkout.id,
      checkoutUrl,
    };
  }

  async findSubscriptionIdAfterCheckoutPaid(input: {
    customerId: string;
    arenaId: string;
  }): Promise<string | null> {
    const result = await this.http.request<AsaasListResponse<AsaasSubscription>>(
      'GET',
      `/v3/subscriptions?customer=${encodeURIComponent(input.customerId)}&limit=50`
    );

    const active = result.data.filter((s) => !s.deleted && s.status === 'ACTIVE');
    const byArenaRef = active.find(
      (s) => s.externalReference === input.arenaId
    );
    if (byArenaRef) return byArenaRef.id;

    active.sort((a, b) => {
      const ta = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
      const tb = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
      return tb - ta;
    });

    return active[0]?.id ?? null;
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
      return this.hydrateSubscription(sub, { fetchPaymentMethod: true });
    } catch {
      return null;
    }
  }

  /**
   * Campo `description` da assinatura no Asaas (PUT /v3/subscriptions/{id}, máx. 500).
   * O checkout só envia `subscription: { cycle, nextDueDate }` — a descrição define-se aqui.
   */
  async setSubscriptionDescription(
    subscriptionId: string,
    description: string
  ): Promise<void> {
    const trimmed = description.trim().slice(0, 500);
    if (!trimmed) return;
    await this.http.request<AsaasSubscription>(
      'PUT',
      `/v3/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { body: { description: trimmed } }
    );
  }

  /**
   * Monta snapshot persistível (doc Asaas: GET assinatura + cobranças; `creditCard`
   * na cobrança com últimos 4, bandeira, token — não guardamos token no snapshot).
   */
  async buildBillingSnapshotForSubscription(
    subscriptionId: string
  ): Promise<SubscriptionBillingSnapshotV1 | null> {
    try {
      const sub = await this.http.request<AsaasSubscription>(
        'GET',
        `/v3/subscriptions/${encodeURIComponent(subscriptionId)}`
      );
      if (sub.deleted) return null;
      const list = await this.http.request<AsaasListResponse<AsaasPayment>>(
        'GET',
        `/v3/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=40`
      );
      const payment = this.pickLatestPaidCardPayment(list.data);
      return this.composeBillingSnapshotV1(sub, payment);
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

    return this.hydrateSubscription(sub);
  }

  /**
   * Atualização de método de pagamento no fluxo de Checkout não é suportada
   * via API direta — o cliente precisa passar por um novo checkout. O caller
   * deve usar prepareCardCollection para gerar um novo link.
   */
  async updateSubscriptionPaymentMethod(
    _input: UpdateSubscriptionPaymentMethodInput
  ): Promise<DomainSubscription> {
    throw new PaymentApiError(
      400,
      'Para alterar o cartão no Asaas Checkout, gere um novo checkout via prepareCardCollection.'
    );
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
    _input: RetryFailedPaymentInput
  ): Promise<RetryFailedPaymentResult> {
    return { paid: false, status: 'not_supported_use_checkout' };
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

    if (payload.checkout) {
      switch (payload.event) {
        case 'CHECKOUT_PAID':
          return {
            kind: 'checkout.paid',
            providerEventId: eventId,
            checkoutId: payload.checkout.id ?? '',
            subscriptionId: parseAsaasSubscriptionIdFromCheckoutWebhookField(
              payload.checkout.subscription
            ),
            customerId: payload.checkout.customer ?? null,
          };
        default:
          return {
            kind: 'unhandled',
            providerEventId: eventId,
            eventType: payload.event,
          };
      }
    }

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

  private pickLatestPaidCardPayment(
    payments: AsaasPayment[]
  ): AsaasPayment | null {
    const paid: AsaasPaymentStatus[] = [
      'RECEIVED',
      'CONFIRMED',
      'RECEIVED_IN_CASH',
    ];
    const sorted = [...payments].sort(
      (a, b) =>
        new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );
    const withCard = sorted.find(
      (p) => paid.includes(p.status) && p.creditCard?.creditCardToken
    );
    if (withCard) return withCard;
    return sorted.find((p) => paid.includes(p.status)) ?? null;
  }

  private composeBillingSnapshotV1(
    sub: AsaasSubscription,
    payment: AsaasPayment | null
  ): SubscriptionBillingSnapshotV1 {
    const cc = payment?.creditCard ?? null;
    const last4 = cc?.creditCardNumber
      ? cc.creditCardNumber.replace(/\D/g, '').slice(-4)
      : null;
    const brandRaw = cc?.creditCardBrand ?? null;
    const brand = brandRaw ? brandRaw.toLowerCase() : null;

    const confirmedAt = (() => {
      if (payment?.paymentDate?.trim()) {
        return payment.paymentDate.trim().slice(0, 10)
      }
      if (payment?.dateCreated?.trim()) {
        const head = payment.dateCreated.trim().slice(0, 10)
        if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
      }
      return new Date().toISOString().slice(0, 10)
    })()

    return {
      schemaVersion: 1,
      provider: 'asaas',
      billingType: sub.billingType ?? null,
      cycle: sub.cycle ?? null,
      subscriptionValueReais: typeof sub.value === 'number' ? sub.value : null,
      cardBrand: brand && brand.length > 0 ? brand : null,
      cardLast4: last4 && last4.length > 0 ? last4 : null,
      lastPaymentId: payment?.id ?? null,
      lastPaymentValueReais: payment ? payment.value : null,
      lastPaymentStatus: payment?.status ?? null,
      lastPaymentConfirmedAt: confirmedAt,
      paymentInstallmentId: payment?.installment ?? null,
      paymentInstallmentNumber:
        typeof payment?.installmentNumber === 'number'
          ? payment.installmentNumber
          : null,
      capturedAt: new Date().toISOString(),
    };
  }

  private async findCustomerByExternalReference(
    externalRef: string
  ): Promise<AsaasCustomer | null> {
    const result = await this.http.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/v3/customers?externalReference=${encodeURIComponent(externalRef)}&limit=1`
    );
    return result.data[0] ?? null;
  }

  private async hydrateSubscription(
    sub: AsaasSubscription,
    options: { fetchPaymentMethod?: boolean } = {}
  ): Promise<DomainSubscription> {
    let paymentMethod: DomainPaymentMethod | null = null;
    let latestPayment: AsaasPayment | null = null;
    let derivedStatus: DomainSubscriptionStatus = mapSubscriptionStatus(
      sub.status
    );

    if (options.fetchPaymentMethod) {
      try {
        const list = await this.http.request<AsaasListResponse<AsaasPayment>>(
          'GET',
          `/v3/subscriptions/${sub.id}/payments?limit=40`
        );
        latestPayment = this.pickLatestPaidCardPayment(list.data);
        paymentMethod = mapPaymentMethodFromPayment(latestPayment);
      } catch {
        // tolerable: payment-method enrichment is best-effort
      }
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
      gatewayBillingType: sub.billingType ?? null,
      primaryItem: {
        id: sub.id,
        priceId: '',
        /** `nextDueDate` do Asaas é data de calendário; ancorar ao meio-dia em Brasília via UTC evita cair no dia anterior no fuso BR. */
        currentPeriodEndIso: sub.nextDueDate
          ? `${sub.nextDueDate}T15:00:00.000Z`
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
