export type DomainSubscriptionStatus =
  | 'active'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'trialing'

export type CardDetails = {
  brand: string
  last4: string
}

export type DomainPaymentMethod = {
  id: string
  type: string
  card: CardDetails | null
}

export type DomainSubscriptionItem = {
  id: string
  priceId: string
  currentPeriodEndIso: string | null
}

export type DomainSubscription = {
  id: string
  customerId: string
  status: DomainSubscriptionStatus
  cancelAtPeriodEnd: boolean
  canceledAtIso: string | null
  metadata: Record<string, string>
  /** Ex.: Asaas `CREDIT_CARD` em GET /v3/subscriptions/{id} — documentação oficial. */
  gatewayBillingType?: string | null
  primaryItem: DomainSubscriptionItem | null
  paymentMethod: DomainPaymentMethod | null
  latestInvoice: {
    id: string | null
    requiresActionClientSecret: string | null
    requiresPaymentMethod: boolean
  } | null
}

export type DomainInvoiceStatus = 'paid' | 'open' | 'void' | 'uncollectible' | 'draft'

export type DomainInvoice = {
  id: string
  amountCents: number
  status: DomainInvoiceStatus
  number: string | null
  description: string | null
  createdAtIso: string
  attemptCount: number
}

type CheckoutEventDetails = {
  checkoutId: string
  customerId: string | null
  operationId?: string | null
  checkoutUrl?: string
}

export type DomainWebhookEvent =
  | {
      kind: 'subscription.updated'
      providerEventId: string
      subscription: DomainSubscription
    }
  | {
      kind: 'subscription.deleted'
      providerEventId: string
      subscription: DomainSubscription
    }
  | {
      kind: 'invoice.paid'
      providerEventId: string
      invoice: DomainInvoice
      subscriptionId: string | null
    }
  | {
      kind: 'invoice.payment_failed'
      providerEventId: string
      invoice: DomainInvoice
      subscriptionId: string | null
    }
  | {
      kind: 'invoice.refunded'
      providerEventId: string
      invoice: DomainInvoice
      subscriptionId: string | null
    }
  | {
      kind: 'invoice.chargeback'
      providerEventId: string
      invoice: DomainInvoice
      subscriptionId: string | null
    }
  | {
      kind: 'invoice.action_required'
      providerEventId: string
      invoice: DomainInvoice
      subscriptionId: string | null
    }
  | (CheckoutEventDetails & {
      kind: 'checkout.paid'
      providerEventId: string
      subscriptionId: string | null
    })
  | (CheckoutEventDetails & {
      kind: 'checkout.created' | 'checkout.canceled' | 'checkout.expired'
      providerEventId: string
    })
  | { kind: 'unhandled'; providerEventId: string; eventType: string }
