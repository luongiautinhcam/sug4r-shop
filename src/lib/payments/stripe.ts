import type {
  PaymentAdapter,
  PaymentIntentResult,
  WebhookEvent,
} from "./types";

/**
 * Stripe payment adapter (stub).
 * TODO: Implement full Stripe integration when Stripe keys are configured.
 */
export const stripeAdapter: PaymentAdapter = {
  name: "stripe",

  async createPaymentIntent(order): Promise<PaymentIntentResult> {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
    }

    // TODO: Create a Stripe Checkout Session
    // const stripe = new Stripe(secretKey);
    // const session = await stripe.checkout.sessions.create({
    //   mode: "payment",
    //   customer_email: order.customerEmail,
    //   line_items: [{ ... }],
    //   success_url: `${SITE_URL}/order/${order.orderCode}?paid=1`,
    //   cancel_url: `${SITE_URL}/checkout?cancelled=1`,
    //   metadata: { orderId: order.id, orderCode: order.orderCode },
    // });

    throw new Error("Stripe integration is not yet implemented.");
  },

  async verifyWebhook(request: Request): Promise<WebhookEvent> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("Stripe webhook secret is not configured.");
    }

    // TODO: Verify Stripe webhook signature
    // const signature = request.headers.get("stripe-signature");
    // const body = await request.text();
    // const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    throw new Error("Stripe webhook verification is not yet implemented.");
  },
};
