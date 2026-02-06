export interface PaymentIntentResult {
  /** Payment record ID in our database */
  paymentId: string;
  /** External provider transaction/session ID (if applicable) */
  providerSessionId?: string;
  /** URL to redirect the customer to (e.g., Stripe checkout) */
  redirectUrl?: string;
  /** Instructions to display to the customer (e.g., bank transfer details) */
  instructions?: string;
}

export interface PaymentInstructions {
  /** Human-readable instructions */
  text: string;
  /** Bank details or reference info */
  details: Record<string, string>;
}

export interface WebhookEvent {
  /** The event type (e.g., 'payment.confirmed', 'payment.failed') */
  type: string;
  /** Our order ID (mapped from provider data) */
  orderId: string;
  /** External provider transaction ID */
  providerTxId: string;
  /** Amount in cents */
  amount: number;
  /** Currency code */
  currency: string;
  /** Raw provider data (will be redacted before storage) */
  rawData: Record<string, unknown>;
}

export interface PaymentAdapter {
  /** Adapter name */
  name: string;

  /** Creates a payment intent/session for the given order */
  createPaymentIntent(order: {
    id: string;
    orderCode: string;
    total: number;
    currency: string;
    customerEmail: string;
  }): Promise<PaymentIntentResult>;

  /** Verifies and parses a webhook request from the payment provider */
  verifyWebhook?(request: Request): Promise<WebhookEvent>;

  /** Returns payment instructions for display (manual methods) */
  getPaymentInstructions?(orderCode: string): PaymentInstructions | null;
}
