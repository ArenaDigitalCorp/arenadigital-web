import { normalizePhone, normalizeEmail } from '@/lib/brasil-document'
import Stripe from 'stripe'
import type {
  DomainInvoice,
  DomainInvoiceStatus,
  DomainPaymentMethod,
  DomainSubscription,
  DomainSubscriptionStatus,
  DomainWebhookEvent
} from '../domain/types'
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
  UpdateSubscriptionPaymentMethodInput
} from './payment-gateway.interface'

type StripeSubscriptionWithInvoice = Stripe.Subscription & {
  latest_invoice:
    | (Stripe.Invoice & { payment_intent: Stripe.PaymentIntent | null })
    | string
    | null
}

function buildStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }
  return new Stripe(secret, { apiVersion: '2026-03-25.dahlia' })
}

function epochToIso(epoch?: number | null): string | null {
  return epoch ? new Date(epoch * 1000).toISOString() : null
}

function extractCustomerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
}

function mapPaymentMethod(
  pm: Stripe.PaymentMethod | string | null | undefined
): DomainPaymentMethod | null {
  if (!pm || typeof pm === 'string') return null

  if (pm.type === 'card' && pm.card) {
    return {
      id: pm.id,
      type: 'card',
      card: {
        brand: pm.card.brand ?? 'unknown',
        last4: pm.card.last4 ?? '****'
      }
    }
  }

  return { id: pm.id, type: pm.type, card: null }
}

function mapSubscription(sub: Stripe.Subscription): DomainSubscription {
  const item = sub.items.data[0]
  const latestInvoice = (sub as StripeSubscriptionWithInvoice).latest_invoice

  let latestInvoiceMapped: DomainSubscription['latestInvoice'] = null

  if (latestInvoice && typeof latestInvoice !== 'string') {
    const paymentIntent = latestInvoice.payment_intent
    const requiresAction =
      paymentIntent && typeof paymentIntent !== 'string'
        ? paymentIntent.status === 'requires_action'
          ? paymentIntent.client_secret
          : null
        : null
    const requiresPaymentMethod =
      paymentIntent && typeof paymentIntent !== 'string'
        ? paymentIntent.status === 'requires_payment_method'
        : false

    latestInvoiceMapped = {
      id: latestInvoice.id ?? null,
      requiresActionClientSecret: requiresAction ?? null,
      requiresPaymentMethod
    }
  } else if (typeof latestInvoice === 'string') {
    latestInvoiceMapped = {
      id: latestInvoice,
      requiresActionClientSecret: null,
      requiresPaymentMethod: false
    }
  }

  return {
    id: sub.id,
    customerId: extractCustomerId(sub),
    status: sub.status as DomainSubscriptionStatus,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    canceledAtIso: epochToIso(sub.canceled_at),
    metadata: (sub.metadata ?? {}) as Record<string, string>,
    primaryItem: item
      ? {
          id: item.id,
          priceId: item.price?.id ?? '',
          currentPeriodEndIso: epochToIso(item.current_period_end)
        }
      : null,
    paymentMethod: mapPaymentMethod(sub.default_payment_method),
    latestInvoice: latestInvoiceMapped
  }
}

function mapInvoice(invoice: Stripe.Invoice): DomainInvoice {
  return {
    id: invoice.id ?? '',
    amountCents: invoice.amount_paid || invoice.amount_due || 0,
    status: (invoice.status ?? 'draft') as DomainInvoiceStatus,
    number: invoice.number ?? null,
    description: invoice.description ?? null,
    createdAtIso: new Date(invoice.created * 1000).toISOString(),
    attemptCount: invoice.attempt_count ?? 0
  }
}

function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const ref = invoice.parent?.subscription_details?.subscription
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

export class StripeGateway implements PaymentGateway {
  readonly providerName: PaymentProvider = 'stripe'
  readonly webhookSignatureHeader = 'stripe-signature'

  constructor(private readonly client: Stripe = buildStripeClient()) {}

  private getWebhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable')
    }
    return secret
  }

  async createCustomer(input: CreateCustomerInput): Promise<{ id: string }> {
    const customer = await this.client.customers.create({
      email: normalizeEmail(input.email),
      name: input.name ?? undefined,
      phone: normalizePhone(input.phone) ?? undefined,
      metadata: input.metadata
    })
    return { id: customer.id }
  }

  async prepareCardCollection(
    input: PrepareCardCollectionInput
  ): Promise<CardCollectionContext> {
    const setupIntent = await this.client.setupIntents.create(
      {
        customer: input.customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: input.metadata
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    )

    if (!setupIntent.client_secret) {
      throw new Error('SetupIntent did not return a client_secret.')
    }

    return { provider: 'stripe', clientSecret: setupIntent.client_secret }
  }

  async createSubscription(
    input: CreateSubscriptionInput
  ): Promise<DomainSubscription> {
    if (!input.plan.gatewayPriceId) {
      throw new Error(
        `Stripe: plano "${input.plan.key}" sem gatewayPriceId configurado.`
      )
    }

    await this.setCustomerDefaultPaymentMethod(
      input.customerId,
      input.paymentMethodId
    )

    const sub = await this.client.subscriptions.create(
      {
        customer: input.customerId,
        items: [{ price: input.plan.gatewayPriceId }],
        default_payment_method: input.paymentMethodId,
        payment_behavior: 'allow_incomplete',
        collection_method: 'charge_automatically',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'off'
        },
        metadata: input.metadata,
        expand: ['latest_invoice.payment_intent']
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    )

    return mapSubscription(sub)
  }

  async retrieveSubscription(
    subscriptionId: string
  ): Promise<DomainSubscription | null> {
    try {
      const sub = await this.client.subscriptions.retrieve(subscriptionId)
      return mapSubscription(sub)
    } catch {
      return null
    }
  }

  async retrieveSubscriptionWithPaymentMethod(
    subscriptionId: string
  ): Promise<DomainSubscription | null> {
    try {
      const sub = await this.client.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method']
      })
      return mapSubscription(sub)
    } catch {
      return null
    }
  }

  async changeSubscriptionPlan(
    input: ChangeSubscriptionPlanInput
  ): Promise<DomainSubscription> {
    if (!input.plan.gatewayPriceId) {
      throw new Error(
        `Stripe: plano "${input.plan.key}" sem gatewayPriceId configurado.`
      )
    }

    const existing = await this.client.subscriptions.retrieve(input.subscriptionId)
    const itemId = existing.items.data[0]?.id
    if (!itemId) {
      throw new Error(
        `Stripe: subscription ${input.subscriptionId} não tem item primário.`
      )
    }

    const updated = await this.client.subscriptions.update(
      input.subscriptionId,
      {
        items: [{ id: itemId, price: input.plan.gatewayPriceId }],
        ...(input.paymentMethodId
          ? { default_payment_method: input.paymentMethodId }
          : {}),
        payment_behavior: 'allow_incomplete',
        proration_behavior: 'create_prorations',
        expand: ['latest_invoice.payment_intent']
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    )

    return mapSubscription(updated)
  }

  async updateSubscriptionPaymentMethod(
    input: UpdateSubscriptionPaymentMethodInput
  ): Promise<DomainSubscription> {
    const updated = await this.client.subscriptions.update(
      input.subscriptionId,
      { default_payment_method: input.paymentMethodId },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    )
    return mapSubscription(updated)
  }

  async setSubscriptionCancelAtPeriodEnd(
    subscriptionId: string,
    cancel: boolean
  ): Promise<void> {
    await this.client.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancel
    })
  }

  async cancelSubscriptionImmediately(subscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(subscriptionId)
  }

  async retryFailedPayment(
    input: RetryFailedPaymentInput
  ): Promise<RetryFailedPaymentResult> {
    if (!input.invoiceId) {
      throw new Error(
        'Stripe: retryFailedPayment requer invoiceId (latest_invoice da subscription incompleta).'
      )
    }

    await this.updateSubscriptionPaymentMethod({
      subscriptionId: input.subscriptionId,
      paymentMethodId: input.paymentMethodId
    })

    const invoice = await this.client.invoices.pay(input.invoiceId, {
      payment_method: input.paymentMethodId
    })
    return {
      paid: invoice.status === 'paid',
      status: invoice.status ?? 'unknown'
    }
  }

  async listCustomerInvoices(
    customerId: string,
    limit = 50
  ): Promise<DomainInvoice[]> {
    try {
      const invoices = await this.client.invoices.list({
        customer: customerId,
        limit
      })
      return invoices.data.map(mapInvoice)
    } catch {
      return []
    }
  }

  async verifyAndParseWebhook(
    rawBody: string,
    signature: string
  ): Promise<DomainWebhookEvent> {
    const event = await this.client.webhooks.constructEventAsync(
      rawBody,
      signature,
      this.getWebhookSecret()
    )

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = mapSubscription(event.data.object as Stripe.Subscription)
        return {
          kind: 'subscription.updated',
          providerEventId: event.id,
          subscription: sub
        }
      }
      case 'customer.subscription.deleted': {
        const sub = mapSubscription(event.data.object as Stripe.Subscription)
        return {
          kind: 'subscription.deleted',
          providerEventId: event.id,
          subscription: sub
        }
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        return {
          kind: 'invoice.paid',
          providerEventId: event.id,
          invoice: mapInvoice(invoice),
          subscriptionId: extractInvoiceSubscriptionId(invoice)
        }
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        return {
          kind: 'invoice.payment_failed',
          providerEventId: event.id,
          invoice: mapInvoice(invoice),
          subscriptionId: extractInvoiceSubscriptionId(invoice)
        }
      }
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice
        return {
          kind: 'invoice.action_required',
          providerEventId: event.id,
          invoice: mapInvoice(invoice),
          subscriptionId: extractInvoiceSubscriptionId(invoice)
        }
      }
      default:
        return {
          kind: 'unhandled',
          providerEventId: event.id,
          eventType: event.type
        }
    }
  }

  private async setCustomerDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    await this.client.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId }
    })
  }
}
