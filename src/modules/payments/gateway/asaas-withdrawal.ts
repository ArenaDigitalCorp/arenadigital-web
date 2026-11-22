import { PaymentApiError } from '../errors'
import { AsaasGateway, AsaasHttpClient, type AsaasPayment } from './asaas.gateway'

type Scope = { customerId: string; subscriptionId: string }
type RefundScope = Scope & { paymentId: string; amountCents: number }
type CheckoutScope = Scope & { checkoutId: string }

type RefundState = 'eligible' | 'pending' | 'completed' | 'needs_reconciliation'

const paidStatuses = new Set([
  'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_RECEIVED',
])
const openRefundStatuses = new Set(['PENDING', 'AWAITING_CRITICAL_ACTION_AUTHORIZATION', 'AWAITING_CUSTOMER_EXTERNAL_AUTHORIZATION'])
const localDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' })

function matches(payment: AsaasPayment, scope: Scope) {
  return /^pay_[a-zA-Z0-9_]+$/.test(payment.id)
    && payment.subscription === scope.subscriptionId && payment.customer === scope.customerId
    && !payment.deleted && payment.billingType === 'CREDIT_CARD'
}

function cents(value: number): number {
  const amount = Math.round(value * 100)
  return Number.isSafeInteger(amount) && amount > 0 && amount / 100 === value ? amount : 0
}

function saoPauloInstant(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const instant = new Date(`${date}T00:00:00-03:00`)
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date
    ? instant.toISOString()
    : null
}

function isUnpaidFutureCharge(payment: AsaasPayment, cutoff: string) {
  const originalDue = saoPauloInstant(payment.originalDueDate)
  const due = saoPauloInstant(payment.dueDate)
  return payment.status === 'PENDING' && payment.confirmedDate == null
    && payment.clientPaymentDate == null && payment.paymentDate == null
    && (payment.refunds == null || (Array.isArray(payment.refunds) && payment.refunds.length === 0))
    && originalDue !== null && due !== null && originalDue > cutoff && due > cutoff
}

export function withdrawalRefundState(payment: Pick<AsaasPayment, 'refunds' | 'status'>, amountCents: number): RefundState {
  const entries = payment.refunds ?? []
  const amounts = entries.map(refund => cents(refund.value))
  if (amounts.some(amount => amount === 0)) return 'needs_reconciliation'
  const recorded = entries.reduce((total, entry, index) =>
    entry.status === 'DONE' ? total + amounts[index] : total, 0)
  const pending = entries.some(entry => openRefundStatuses.has(entry.status))
    || ['REFUND_REQUESTED', 'REFUND_IN_PROGRESS'].includes(payment.status)
  if (recorded > amountCents || entries.some(entry => !openRefundStatuses.has(entry.status)
    && !['DONE', 'CANCELLED'].includes(entry.status))) return 'needs_reconciliation'
  if (pending) return 'pending'
  if (recorded === amountCents && amountCents > 0) return 'completed'
  if (entries.length === 0 && ['RECEIVED', 'CONFIRMED'].includes(payment.status)) return 'eligible'
  return 'needs_reconciliation'
}

export class AsaasWithdrawalGateway {
  private readonly subscriptions: AsaasGateway

  constructor(private readonly http = new AsaasHttpClient()) {
    this.subscriptions = new AsaasGateway(http)
  }

  async findConfirmedCheckoutPayment(scope: CheckoutScope): Promise<{
    paymentId: string
    amountCents: number
    firstPaidAt: string
    state: RefundState
  }> {
    const error = () => new PaymentApiError(409, 'Não foi possível confirmar a cobrança original do checkout.')
    if (!scope.checkoutId || !scope.customerId || !scope.subscriptionId) throw error()
    const matchesCheckout = (payment: AsaasPayment) => payment && matches(payment, scope)
      && payment.deleted === false && payment.checkoutSession === scope.checkoutId
    // The Asaas checkoutSession filter can omit recurring Checkout charges
    // even when the charge itself carries the exact Checkout identifier.
    const payments = await this.subscriptions.listSubscriptionPayments(
      scope.subscriptionId, scope.customerId
    )
    const candidates = payments.filter(payment => payment.checkoutSession === scope.checkoutId)
    const originals = candidates.filter(payment => paidStatuses.has(payment.status))
    if (originals.length !== 1) throw error()
    const [candidate] = originals
    const amountCents = cents(candidate.value)
    if (!matchesCheckout(candidate) || !amountCents) throw error()

    const payment = await this.http.request<AsaasPayment>('GET', `/v3/payments/${encodeURIComponent(candidate.id)}`)
    if (!matchesCheckout(payment) || payment.id !== candidate.id
      || cents(payment.value) !== amountCents || !paidStatuses.has(payment.status)) throw error()
    const firstPaidAt = saoPauloInstant(payment.confirmedDate)
    if (!firstPaidAt) throw error()

    // Recurring charges can inherit checkoutSession. They are safe to disregard
    // only when both due dates and the absence of payment evidence prove a future charge.
    const otherCharges = candidates.filter(charge => charge.id !== candidate.id)
    if (otherCharges.length > 0) {
      const originalDue = saoPauloInstant(payment.originalDueDate)
      const due = saoPauloInstant(payment.dueDate)
      const today = saoPauloInstant(localDate.format(new Date()))
      if (!originalDue || !due || !today) throw error()
      const cutoff = [originalDue, due, today].sort()[2]
      if (otherCharges.some(charge => !matchesCheckout(charge) || !isUnpaidFutureCharge(charge, cutoff))) throw error()
    }

    return { paymentId: payment.id, amountCents, firstPaidAt, state: withdrawalRefundState(payment, amountCents) }
  }

  async findFirstPayment(scope: Scope, checkoutPaidAt?: string | null) {
    const payments = await this.subscriptions.listSubscriptionPayments(scope.subscriptionId, scope.customerId)
    const [first, second] = payments.filter(payment => matches(payment, scope) && paidStatuses.has(payment.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.dateCreated.localeCompare(b.dateCreated))
    if (!first || (second?.dueDate === first.dueDate && second.dateCreated === first.dateCreated)) {
      throw new PaymentApiError(409, 'Não foi possível confirmar a primeira cobrança paga do plano.')
    }
    const amountCents = cents(first.value)
    const providerPaidAt = saoPauloInstant(first.clientPaymentDate ?? first.confirmedDate ?? first.paymentDate)
    if (!amountCents || !providerPaidAt || (checkoutPaidAt
      && Math.abs(Date.parse(providerPaidAt) - Date.parse(checkoutPaidAt)) > 7 * 86400000)) {
      throw new PaymentApiError(409, 'A cobrança inicial precisa de conferência antes do estorno.')
    }
    return { paymentId: first.id, amountCents, firstPaidAt: providerPaidAt }
  }

  async getRefundState(scope: RefundScope): Promise<RefundState> {
    const payment = await this.http.request<AsaasPayment>('GET', `/v3/payments/${encodeURIComponent(scope.paymentId)}`)
    if (payment.id !== scope.paymentId || !matches(payment, scope) || cents(payment.value) !== scope.amountCents) {
      throw new PaymentApiError(409, 'A cobrança do Asaas diverge do pedido de desistência.')
    }
    return withdrawalRefundState(payment, scope.amountCents)
  }

  async stopSubscription(scope: Scope, claimDelete: () => Promise<boolean>): Promise<boolean> {
    const path = `/v3/subscriptions/${encodeURIComponent(scope.subscriptionId)}`
    const isRemoved = async () => {
      const subscription = await this.http.request<{ id: string; customer: string; deleted: boolean }>('GET', path)
      if (subscription?.id !== scope.subscriptionId || subscription.customer !== scope.customerId) {
        throw new PaymentApiError(409, 'A assinatura do Asaas diverge do pedido de desistência.')
      }
      if (typeof subscription.deleted !== 'boolean') {
        throw new PaymentApiError(502, 'O Asaas não informou o estado da assinatura.')
      }
      return subscription.deleted
    }

    // Confirm ownership before consuming the single durable deletion attempt.
    if (await isRemoved()) return true
    if (!await claimDelete()) return isRemoved()

    try {
      const removal = await this.http.request<{ id: string; deleted: boolean }>('DELETE', path)
      if (removal?.id === scope.subscriptionId && removal.deleted === true) return true
    } catch {
      // A resposta pode ter se perdido depois da remoção. Consulte antes de concluir.
    }
    if (!await isRemoved()) {
      throw new PaymentApiError(502, 'O Asaas ainda não confirmou o fim da assinatura.')
    }
    return true
  }

  async submitFullRefund(scope: RefundScope): Promise<RefundState> {
    await this.http.request('POST', `/v3/payments/${encodeURIComponent(scope.paymentId)}/refund`, { body: {} })
    return this.getRefundState(scope)
  }
}
