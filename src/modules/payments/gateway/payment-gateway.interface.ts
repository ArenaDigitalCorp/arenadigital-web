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
  arenaId: string
  plan: SubscriptionPlanInfo
  successUrl: string
  cancelUrl: string
  expiredUrl: string
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
      provider: 'asaas-checkout'
      /** ID do checkout criado no Asaas — usado para correlacionar webhook → arena. */
      checkoutId: string
      /** URL hospedada do Asaas para onde redirecionar o cliente. */
      checkoutUrl: string
    }

export type CreateSubscriptionInput = {
  customerId: string
  plan: SubscriptionPlanInfo
  /** Token opaco do método de pagamento (Stripe: pm_xxx). Não usado no fluxo asaas-checkout. */
  paymentMethodId: string
  /** IP do usuário final usado por gateways antifraude (Asaas exige em cartão). */
  remoteIp?: string
  metadata?: Record<string, string>
  idempotencyKey?: string
}

export type ChangeSubscriptionPlanInput = {
  subscriptionId: string
  plan: SubscriptionPlanInfo
  /** Stripe exige. Asaas pode atualizar plano sem novo cartão. */
  paymentMethodId?: string
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

export type SubscriptionCancellationContext = {
  customerId: string | null
  currentPeriodEnd: string | null
  isExperimental: boolean
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
   * Prepara o fluxo de coleta de cartão. Para Stripe retorna clientSecret;
   * para Asaas retorna URL do checkout hospedado.
   */
  prepareCardCollection(
    input: PrepareCardCollectionInput
  ): Promise<CardCollectionContext>

  // ===== Subscription =====
  /**
   * Cria a subscription diretamente (Stripe). No Asaas a subscription é criada
   * pelo próprio checkout — esse método não é chamado nesse fluxo.
   */
  createSubscription?(input: CreateSubscriptionInput): Promise<DomainSubscription>

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
    cancel: boolean,
    context?: SubscriptionCancellationContext
  ): Promise<{ currentPeriodEnd: string | null } | void>

  cancelSubscriptionImmediately(subscriptionId: string): Promise<void>

  // ===== Payment retry / Invoices =====
  retryFailedPayment(
    input: RetryFailedPaymentInput
  ): Promise<RetryFailedPaymentResult>

  listCustomerInvoices(customerId: string, limit?: number): Promise<DomainInvoice[]>

  resolveSubscriptionPaidPeriodEnd?(subscriptionId: string, customerId: string): Promise<string | null>

  /**
   * Após CHECKOUT_PAID: o webhook do Asaas manda `checkout.subscription` como
   * objeto (ciclo/datas), não o id `sub_...`. Só o Asaas implementa — resolve via API.
   */
  findSubscriptionIdAfterCheckoutPaid?(input: {
    customerId: string
    checkoutId: string
  }): Promise<string | null>

  // ===== Webhook =====
  verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): Promise<DomainWebhookEvent>
}
