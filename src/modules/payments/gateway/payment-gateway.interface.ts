import type {
  DomainInvoice,
  DomainSubscription,
  DomainWebhookEvent
} from '../domain/types'

/**
 * Identifica qual provedor está implementando a interface.
 * Usado pelo frontend para decidir qual UI de coleta de cartão renderizar.
 */
export type PaymentProvider = 'stripe' | 'asaas'

export type CreateCustomerInput = {
  email: string
  name?: string | null
  cpfCnpj?: string | null
  phone?: string | null
  postalCode?: string | null
  addressNumber?: string | null
  metadata?: Record<string, string>
}

export type SubscriptionPlanInfo = {
  key: string
  label: string
  priceCents: number
  /** ID externo do preço no provedor (Stripe price_id). Asaas ignora. */
  gatewayPriceId: string | null
  /** Frequência da cobrança recorrente. Default mensal. */
  cycle?: 'MONTHLY' | 'YEARLY'
}

export type PrepareCardCollectionInput = {
  customerId: string
  metadata?: Record<string, string>
  idempotencyKey?: string
}

/**
 * Resultado de prepareCardCollection — discriminated union por provedor.
 * O frontend usa o campo `provider` para decidir qual componente renderizar.
 */
export type CardCollectionContext =
  | {
      provider: 'stripe'
      /** Client secret do SetupIntent. Usado pelo Stripe Elements no frontend. */
      clientSecret: string
    }
  | {
      provider: 'asaas'
      /** O frontend coleta cartão num form próprio e envia raw → /api/payments/tokenize-card. */
      customerId: string
    }

export type TokenizeCardInput = {
  customerId: string
  card: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    cvv: string
  }
  holder: {
    name: string
    email: string
    cpfCnpj: string
    postalCode: string
    addressNumber: string
    phone: string
  }
  remoteIp: string
}

export type CreateSubscriptionInput = {
  customerId: string
  plan: SubscriptionPlanInfo
  /** Token opaco do método de pagamento. Stripe: pm_xxx. Asaas: creditCardToken. */
  paymentMethodId: string
  metadata?: Record<string, string>
  idempotencyKey?: string
}

export type ChangeSubscriptionPlanInput = {
  subscriptionId: string
  plan: SubscriptionPlanInfo
  paymentMethodId: string
  idempotencyKey?: string
}

export type UpdateSubscriptionPaymentMethodInput = {
  subscriptionId: string
  paymentMethodId: string
  idempotencyKey?: string
}

export type RetryFailedPaymentInput = {
  subscriptionId: string
  paymentMethodId: string
  /** Latest invoice/payment id, quando relevante (Stripe). Asaas pode ignorar. */
  invoiceId?: string | null
}

export type RetryFailedPaymentResult = {
  paid: boolean
  status: string
}

export interface PaymentGateway {
  /** Identificador do provedor — usado pelo frontend pra escolher UI. */
  readonly providerName: PaymentProvider

  /** Header HTTP que carrega a assinatura do webhook (provedor-específico). */
  readonly webhookSignatureHeader: string

  // ===== Customer =====
  createCustomer(input: CreateCustomerInput): Promise<{ id: string }>

  // ===== Card collection =====
  /**
   * Prepara o frontend para coletar dados do cartão. Retorna contexto
   * provider-específico (clientSecret pro Stripe, customerId pro Asaas).
   */
  prepareCardCollection(
    input: PrepareCardCollectionInput
  ): Promise<CardCollectionContext>

  /**
   * Tokeniza dados de cartão recebidos do frontend.
   * Asaas usa esse fluxo (form próprio). Stripe não suporta — frontend tokeniza via Elements.
   */
  tokenizeCard?(input: TokenizeCardInput): Promise<{ token: string }>

  /**
   * Dados de cobrança já gravados no cliente do provedor (ex.: arena + dono no Asaas),
   * para não repetir CEP/telefone no formulário de cartão.
   */
  resolveBillingHolderForCardTokenize?(
    customerId: string
  ): Promise<TokenizeCardInput['holder']>

  // ===== Subscription =====
  createSubscription(input: CreateSubscriptionInput): Promise<DomainSubscription>

  retrieveSubscription(subscriptionId: string): Promise<DomainSubscription | null>

  retrieveSubscriptionWithPaymentMethod(
    subscriptionId: string
  ): Promise<DomainSubscription | null>

  changeSubscriptionPlan(
    input: ChangeSubscriptionPlanInput
  ): Promise<DomainSubscription>

  updateSubscriptionPaymentMethod(
    input: UpdateSubscriptionPaymentMethodInput
  ): Promise<DomainSubscription>

  setSubscriptionCancelAtPeriodEnd(
    subscriptionId: string,
    cancel: boolean
  ): Promise<void>

  cancelSubscriptionImmediately(subscriptionId: string): Promise<void>

  // ===== Payment retry / Invoices =====
  retryFailedPayment(
    input: RetryFailedPaymentInput
  ): Promise<RetryFailedPaymentResult>

  listCustomerInvoices(customerId: string, limit?: number): Promise<DomainInvoice[]>

  // ===== Webhook =====
  verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): Promise<DomainWebhookEvent>
}
