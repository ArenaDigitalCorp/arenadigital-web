import { asaasDomesticPhone, normalizeCpfCnpj, normalizeEmail, normalizeCep, isValidCep } from '@/lib/brasil-document'
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
  SubscriptionCancellationContext,
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
  checkoutSession?: string | null;
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
  endDate?: string | null;
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
  | 'AWAITING_CHECKOUT_RISK_ANALYSIS'
  | 'AWAITING_RISK_ANALYSIS';

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription: string | null;
  checkoutSession?: string | null;
  value: number;
  netValue: number | null;
  status: AsaasPaymentStatus;
  billingType: string;
  dueDate: string;
  originalDueDate?: string | null;
  deleted?: boolean;
  dateCreated: string;
  /** Data de liquidação (doc cobrança GET). */
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  refunds?: { status: string; value: number }[] | null;
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
  callback?: { successUrl?: string | null };
  link?: string | null;
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

function checkoutUrl(id: string, link?: string | null): string {
  if (link) return link;
  const sandbox = new URL(getBaseUrl()).hostname === 'api-sandbox.asaas.com';
  const url = new URL('/checkoutSession/show', sandbox ? 'https://sandbox.asaas.com' : 'https://asaas.com');
  url.searchParams.set('id', id);
  return url.toString();
}

function checkoutOperationId(callback: AsaasCheckoutPayload['callback']): string | null {
  if (!callback?.successUrl) return null;
  try {
    const url = new URL(callback.successUrl);
    const id = url.searchParams.get('checkoutOperation');
    if (url.protocol === 'https:'
      && /^\/dashboard\/settings\/subscription\/[^/]+\/checkout-return$/.test(url.pathname)
      && id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      return id;
    }
  } catch {
    // Some external checkouts use a relative or otherwise invalid callback.
  }
  return null;
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

function calendarDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? value
    : null;
}

const asaasDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function nextBillingDate(dueDate: string, cycle: string): string {
  if (cycle !== 'MONTHLY' && cycle !== 'YEARLY') {
    throw new PaymentApiError(409, 'O ciclo da assinatura precisa ser confirmado antes do cancelamento.');
  }
  const date = new Date(`${dueDate}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + (cycle === 'YEARLY' ? 12 : 1), 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function paidBillingPeriodEnd(
  payments: AsaasPayment[],
  cycle: string,
  issuedDates = payments
): string | null {
  let paidThrough: string | null = null;
  for (const payment of payments) {
    if (payment.deleted || mapInvoiceStatus(payment.status) !== 'paid') continue;
    const dueDate = calendarDate(payment.originalDueDate);
    if (!dueDate) throw asaasCancellationUnconfirmed();
    const end = nextBillingDate(dueDate, cycle);
    if (!paidThrough || end > paidThrough) paidThrough = end;
  }
  if (!paidThrough) return null;
  const nextCycle = paidThrough.slice(0, 7);
  const end = paidThrough;
  // Preserve the provider's billing day when the next cycle is already issued.
  const nextKnownDates = issuedDates
    .filter((payment) => !payment.deleted && payment.originalDueDate?.slice(0, 7) === nextCycle)
    .map((payment) => calendarDate(payment.originalDueDate))
    .filter((date): date is string => date !== null && date >= end)
    .sort();
  return nextKnownDates[0] ?? end;
}

function sameSubscriptionPayment(payment: AsaasPayment, subscriptionId: string, customerId: string) {
  return payment?.subscription === subscriptionId && payment.customer === customerId;
}

function dueOnOrAfter(payment: AsaasPayment, cutoff: string, requireMatchingCutoff = false) {
  const dueDate = calendarDate(payment.dueDate);
  const originalDueDate = calendarDate(payment.originalDueDate);
  if (requireMatchingCutoff && (dueDate === cutoff || originalDueDate === cutoff)) {
    return dueDate === cutoff && originalDueDate === cutoff;
  }
  return dueDate !== null && originalDueDate !== null
    && dueDate >= cutoff && originalDueDate >= cutoff;
}

function isUnpaid(payment: AsaasPayment) {
  return payment.status === 'PENDING' || payment.status === 'OVERDUE';
}

function asaasCancellationUnconfirmed() {
  return new PaymentApiError(
    503,
    'O Asaas ainda não confirmou todo o cancelamento. Consulte o plano e tente novamente.'
  );
}

function localBillingDate(value: string | null | undefined): string | null {
  return value && Number.isFinite(Date.parse(value))
    ? asaasDateFormatter.format(new Date(value))
    : null;
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

export class AsaasHttpClient {
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
    // Customer CEP is optional. Keep malformed historical contacts locally,
    // but never forward them as an invalid provider billing address.
    const postalCode = isValidCep(input.postalCode) ? normalizeCep(input.postalCode) : undefined;

    if (externalRef) {
      const existing = await this.findCustomerByExternalReference(externalRef);
      if (existing) {
        await this.http.request<AsaasCustomer>(
          'PUT',
          `/v3/customers/${existing.id}`,
          {
            body: {
              name: input.name ?? existing.name,
              email: normalizeEmail(input.email),
              cpfCnpj: normalizeCpfCnpj(input.cpfCnpj),
              phone: asaasDomesticPhone(input.phone),
              postalCode,
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
          email: normalizeEmail(input.email),
          cpfCnpj: normalizeCpfCnpj(input.cpfCnpj),
          phone: asaasDomesticPhone(input.phone),
          postalCode,
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
    const isExperimentalPlan = input.plan.key === 'experimental';

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
            ...(isExperimentalPlan ? { endDate: addDays(today, 5) } : {}),
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
      }
    );

    if (!checkout?.id) {
      throw new PaymentApiError(
        500,
        'Asaas retornou checkout sem identificador.'
      );
    }

    return {
      provider: 'asaas-checkout',
      checkoutId: checkout.id,
      checkoutUrl: checkoutUrl(checkout.id, checkout.link ?? checkout.url),
    };
  }

  async findSubscriptionIdAfterCheckoutPaid(input: {
    customerId: string;
    checkoutId: string;
  }): Promise<string | null> {
    const { customerId, checkoutId } = input;
    if (!customerId || !checkoutId) return null;

    const limit = 100;
    const filters = new URLSearchParams({ checkoutSession: checkoutId, customer: customerId, limit: String(limit) });
    const paymentList = await this.http.request<AsaasListResponse<AsaasPayment>>('GET', `/v3/payments?${filters}`);
    const subscriptionIds = new Set<string>();
    if (paymentList?.hasMore === false && Array.isArray(paymentList.data)) {
      for (const payment of paymentList.data) {
        if (payment?.checkoutSession !== checkoutId) continue;
        if (payment.customer !== customerId) return null;
        if (!payment.deleted && typeof payment.subscription === 'string' && /^sub_[A-Za-z0-9_]+$/.test(payment.subscription)) {
          subscriptionIds.add(payment.subscription);
        }
      }
      if (subscriptionIds.size > 1) return null;
      if (subscriptionIds.size === 1) return [...subscriptionIds][0];
    }

    // A paid checkout can be missing from the payment list's checkout index.
    // Resolve by the checkout ID returned on the recurring subscription itself.
    const seen = new Set<string>();
    let matched: string | null = null;
    let offset = 0;
    for (let page = 0; page < 100; page++) {
      const pageFilters = new URLSearchParams({ customer: customerId, limit: String(limit), offset: String(offset) });
      const list = await this.http.request<AsaasListResponse<AsaasSubscription>>('GET', `/v3/subscriptions?${pageFilters}`);
      if (list?.offset !== offset || typeof list.hasMore !== 'boolean' || !Array.isArray(list.data)) return null;
      for (const sub of list.data) {
        if (sub?.customer !== customerId || typeof sub.id !== 'string'
          || !/^sub_[A-Za-z0-9_]+$/.test(sub.id) || seen.has(sub.id)) return null;
        seen.add(sub.id);
        if (sub.checkoutSession !== checkoutId) continue;
        if (matched || sub.deleted !== false) return null;
        matched = sub.id;
      }
      if (!list.hasMore) {
        return Number.isSafeInteger(list.totalCount) && list.totalCount === seen.size ? matched : null;
      }
      if (!list.data.length) return null;
      offset += list.data.length;
    }
    return null;
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
    cancel: boolean,
    context?: SubscriptionCancellationContext
  ): Promise<{ currentPeriodEnd: string | null } | void> {
    const subscriptionPath = `/v3/subscriptions/${encodeURIComponent(subscriptionId)}`;
    const subscription = await this.http.request<AsaasSubscription>('GET', subscriptionPath);
    const customerId = context?.customerId;
    const matchesSubscription = (sub: AsaasSubscription) =>
      sub?.id === subscriptionId && sub.customer === customerId && sub.deleted === false;
    if (!customerId || !matchesSubscription(subscription)) {
      throw asaasCancellationUnconfirmed();
    }

    const today = asaasDateFormatter.format(new Date());
    const localDate = localBillingDate(context.currentPeriodEnd);
    if (!cancel) {
      const confirmedActive = (sub: AsaasSubscription) =>
        matchesSubscription(sub) && sub.status === 'ACTIVE' && sub.endDate == null;
      // A previous attempt may have resumed the recurrence before the local update failed.
      if (confirmedActive(subscription)) return;
      if (!localDate || localDate <= today || subscription.status === 'EXPIRED' || context.isExperimental) {
        throw new PaymentApiError(409, 'O período da assinatura terminou. Consulte os planos para assinar novamente.');
      }
      try {
        await this.http.request<AsaasSubscription>('PUT', subscriptionPath, {
          body: { endDate: null, status: 'ACTIVE', nextDueDate: localDate, updatePendingPayments: false },
        });
      } catch {
        // Only confirm reactivation once the provider reports the recurrence active.
      }
      const resumed = await this.http.request<AsaasSubscription>('GET', subscriptionPath);
      const resumedDate = calendarDate(resumed?.nextDueDate);
      if (!confirmedActive(resumed) || !resumedDate || resumedDate < localDate) {
        throw asaasCancellationUnconfirmed();
      }
      return;
    }

    const tomorrow = addDays(today, 1);
    const initialPayments = await this.listSubscriptionPayments(subscriptionId, customerId);
    const paidDate = context.isExperimental
      ? null
      : paidBillingPeriodEnd(initialPayments, subscription.cycle);
    const protectedDate = paidDate ?? localDate;
    const existingEnd = calendarDate(subscription.endDate);
    const priorCutoff = !context.isExperimental && existingEnd ? addDays(existingEnd, 1) : null;
    // When the Asaas cutoff was inclusive, retries must still remove that day's proven renewal.
    const renewalOnCutoff = paidDate && (paidDate === today || (paidDate < today && paidDate === existingEnd))
      ? paidDate
      : null;
    const firstFutureDate = renewalOnCutoff ?? tomorrow;
    const earliestFuture = priorCutoff && priorCutoff < firstFutureDate ? priorCutoff : firstFutureDate;
    const cutoff = protectedDate && protectedDate > earliestFuture ? protectedDate : earliestFuture;
    // The cutoff can contain both a renewal and invoices rescheduled from another cycle.
    const requireMatchingCutoff = cutoff === renewalOnCutoff;
    const nextUnissued = calendarDate(subscription.nextDueDate);
    const hasStoppedBeforeIssuance = subscription.status === 'INACTIVE' || subscription.status === 'EXPIRED'
      || (nextUnissued !== null && nextUnissued > cutoff);
    // Asaas rejects past end dates. Its inclusive limit is safe only when
    // another charge due on the cutoff date cannot still be generated.
    const useInclusiveCutoff = requireMatchingCutoff && hasStoppedBeforeIssuance;
    const nextScheduledDate = nextUnissued && nextUnissued < cutoff ? nextUnissued : cutoff;
    const endDate = useInclusiveCutoff ? cutoff : addDays(nextScheduledDate, -1);
    const confirmedStop = (sub: AsaasSubscription) => {
      const configuredEnd = calendarDate(sub?.endDate);
      const nextDueDate = calendarDate(sub?.nextDueDate);
      return matchesSubscription(sub)
        && configuredEnd !== null && configuredEnd <= endDate
        && (sub.status === 'INACTIVE' || sub.status === 'EXPIRED'
          || (sub.status === 'ACTIVE' && nextDueDate !== null && nextDueDate > configuredEnd));
    };

    if (!confirmedStop(subscription)) {
      if (requireMatchingCutoff && endDate < today) throw asaasCancellationUnconfirmed();
      try {
        await this.http.request<AsaasSubscription>('PUT', subscriptionPath, {
          body: { endDate, updatePendingPayments: false },
        });
      } catch {
        // A failed response may still have updated the end date.
      }
      const updated = await this.http.request<AsaasSubscription>('GET', subscriptionPath);
      if (!confirmedStop(updated)) throw asaasCancellationUnconfirmed();
    }

    // Read every page before any deletes. Deleted rows disappear from this listing.
    const pending = await this.listSubscriptionPayments(subscriptionId, customerId);
    for (const payment of pending) {
      if (payment.deleted || !isUnpaid(payment) || !dueOnOrAfter(payment, cutoff, requireMatchingCutoff)) continue;
      await this.removeUnpaidSubscriptionPayment({
        paymentId: payment.id,
        subscriptionId,
        customerId,
        notBefore: cutoff,
        requireMatchingCutoff,
      });
    }
    const remaining = await this.listSubscriptionPayments(subscriptionId, customerId);
    if (remaining.some((payment) => {
      if (payment.deleted) return false;
      if (!isUnpaid(payment) && payment.status !== 'AWAITING_RISK_ANALYSIS'
        && payment.status !== 'AWAITING_CHECKOUT_RISK_ANALYSIS') return false;
      if (!calendarDate(payment.dueDate) || !calendarDate(payment.originalDueDate)) return true;
      return dueOnOrAfter(payment, cutoff, requireMatchingCutoff);
    })) throw asaasCancellationUnconfirmed();

    const finalSubscription = await this.http.request<AsaasSubscription>('GET', subscriptionPath);
    if (!confirmedStop(finalSubscription)) throw asaasCancellationUnconfirmed();

    let confirmedPeriodEnd = context.isExperimental
      ? null
      : paidBillingPeriodEnd(remaining, subscription.cycle, [...pending, ...remaining]);
    if (confirmedPeriodEnd && priorCutoff && priorCutoff > confirmedPeriodEnd
      && priorCutoff.slice(0, 7) === confirmedPeriodEnd.slice(0, 7)) {
      confirmedPeriodEnd = priorCutoff;
    }
    return {
      currentPeriodEnd: confirmedPeriodEnd && confirmedPeriodEnd !== localDate
        ? `${confirmedPeriodEnd}T15:00:00.000Z`
        : context.currentPeriodEnd,
    };
  }

  async resolveSubscriptionPaidPeriodEnd(subscriptionId: string, customerId: string): Promise<string | null> {
    const path = `/v3/subscriptions/${encodeURIComponent(subscriptionId)}`;
    const subscription = await this.http.request<AsaasSubscription>('GET', path);
    if (subscription?.id !== subscriptionId || subscription.customer !== customerId || subscription.deleted) {
      throw asaasCancellationUnconfirmed();
    }
    const payments = await this.listSubscriptionPayments(subscriptionId, customerId);
    const end = paidBillingPeriodEnd(payments, subscription.cycle);
    return end ? `${end}T15:00:00.000Z` : null;
  }

  async listSubscriptionPayments(subscriptionId: string, customerId: string): Promise<AsaasPayment[]> {
    const path = `/v3/subscriptions/${encodeURIComponent(subscriptionId)}/payments`;
    const payments = new Map<string, AsaasPayment>();
    const pageSize = 100;
    let offset = 0;
    for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
      const response = await this.http.request<AsaasListResponse<AsaasPayment>>(
        'GET', `${path}?limit=${pageSize}&offset=${offset}`
      );
      if (!response || response.offset !== offset || typeof response.hasMore !== 'boolean'
        || !Array.isArray(response.data)) throw asaasCancellationUnconfirmed();
      for (const payment of response.data) {
        if (!sameSubscriptionPayment(payment, subscriptionId, customerId)
          || typeof payment.id !== 'string' || !payment.id || payments.has(payment.id)) {
          throw asaasCancellationUnconfirmed();
        }
        payments.set(payment.id, payment);
      }
      if (!response.hasMore) {
        if (Number.isSafeInteger(response.totalCount) && payments.size !== response.totalCount) {
          throw asaasCancellationUnconfirmed();
        }
        return [...payments.values()];
      }
      if (response.data.length === 0) throw asaasCancellationUnconfirmed();
      offset += response.data.length;
    }
    throw asaasCancellationUnconfirmed();
  }

  async removeUnpaidSubscriptionPayment(input: {
    paymentId: string;
    subscriptionId: string;
    customerId: string;
    notBefore?: string;
    requireMatchingCutoff?: boolean;
  }): Promise<void> {
    const { paymentId, subscriptionId, customerId, notBefore, requireMatchingCutoff } = input;
    const path = `/v3/payments/${encodeURIComponent(paymentId)}`;
    const read = async () => {
      try {
        const payment = await this.http.request<AsaasPayment>('GET', path);
        if (!sameSubscriptionPayment(payment, subscriptionId, customerId) || payment.id !== paymentId) {
          throw asaasCancellationUnconfirmed();
        }
        return payment;
      } catch (error) {
        if (error instanceof PaymentApiError && error.statusCode === 404) return null;
        throw error;
      }
    };
    const canRemove = (payment: AsaasPayment) =>
      isUnpaid(payment) && (!notBefore || dueOnOrAfter(payment, notBefore, requireMatchingCutoff));

    const payment = await read();
    if (!payment || payment.deleted || !canRemove(payment)) return;
    try {
      const removed = await this.http.request<{ id: string; deleted: boolean }>('DELETE', path);
      if (removed?.id === paymentId && removed.deleted === true) return;
    } catch {
      // A failed response may still have removed this payment.
    }
    const current = await read();
    if (current && !current.deleted && canRemove(current)) throw asaasCancellationUnconfirmed();
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
      const checkoutId = payload.checkout.id ?? '';
      const details = {
        checkoutId,
        customerId: payload.checkout.customer ?? null,
        operationId: checkoutOperationId(payload.checkout.callback),
        checkoutUrl: checkoutId ? checkoutUrl(checkoutId, payload.checkout.link) : undefined,
      };
      switch (payload.event) {
        case 'CHECKOUT_CREATED':
          return { kind: 'checkout.created', providerEventId: eventId, ...details };
        case 'CHECKOUT_PAID':
          return {
            kind: 'checkout.paid',
            providerEventId: eventId,
            ...details,
            subscriptionId: parseAsaasSubscriptionIdFromCheckoutWebhookField(
              payload.checkout.subscription
            ),
          };
        case 'CHECKOUT_CANCELED':
          return {
            kind: 'checkout.canceled',
            providerEventId: eventId,
            ...details,
          };
        case 'CHECKOUT_EXPIRED':
          return {
            kind: 'checkout.expired',
            providerEventId: eventId,
            ...details,
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
        case 'PAYMENT_REFUNDED':
          return {
            kind: 'invoice.refunded',
            providerEventId: eventId,
            invoice: mapPayment(payload.payment),
            subscriptionId,
          };
        case 'PAYMENT_CHARGEBACK_REQUESTED':
        case 'PAYMENT_CHARGEBACK_DISPUTE':
        case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
          return {
            kind: 'invoice.chargeback',
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
        case 'SUBSCRIPTION_UPDATED':
        case 'SUBSCRIPTION_INACTIVATED': {
          const hydrated = await this.hydrateSubscription(sub);
          return {
            kind: 'subscription.updated',
            providerEventId: eventId,
            subscription: hydrated,
          };
        }
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
