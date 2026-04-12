import { NextResponse } from 'next/server'

export class StripeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly detail?: string
  ) {
    super(message)
    this.name = this.constructor.name
  }

  toNextResponse() {
    return NextResponse.json(
      { error: this.message, detail: this.detail },
      { status: this.statusCode }
    )
  }
}

export class InvalidPlanKeyError extends StripeApiError {
  constructor() {
    super(400, 'Invalid plan key')
  }
}

export class MissingStripeSignatureError extends StripeApiError {
  constructor() {
    super(400, 'Missing stripe-signature header')
  }
}

export class InvalidStripeWebhookSignatureError extends StripeApiError {
  constructor() {
    super(400, 'Invalid Stripe webhook signature')
  }
}

export class StripeConfigurationError extends StripeApiError {
  constructor(detail?: string) {
    super(500, 'Invalid Stripe checkout configuration', detail)
  }
}

export class CreateSubscriptionFailedError extends StripeApiError {
  constructor(detail?: string) {
    super(500, 'Failed to create subscription', detail)
  }
}
