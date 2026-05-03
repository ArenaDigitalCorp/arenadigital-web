import { NextResponse } from 'next/server';

export class PaymentApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toNextResponse() {
    return NextResponse.json(
      { error: this.message, detail: this.detail },
      { status: this.statusCode }
    );
  }
}

export class InvalidPlanKeyError extends PaymentApiError {
  constructor() {
    super(400, 'Invalid plan key');
  }
}

export class MissingWebhookSignatureError extends PaymentApiError {
  constructor() {
    super(400, 'Missing webhook signature header');
  }
}

export class InvalidWebhookSignatureError extends PaymentApiError {
  constructor() {
    super(400, 'Invalid webhook signature');
  }
}

export class PaymentConfigurationError extends PaymentApiError {
  constructor(detail?: string) {
    super(500, 'Invalid payment gateway configuration', detail);
  }
}

export class CreateSubscriptionFailedError extends PaymentApiError {
  constructor(detail?: string) {
    super(500, 'Failed to create subscription', detail);
  }
}
