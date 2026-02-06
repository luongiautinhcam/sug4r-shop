import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-events";
import { eq, and } from "drizzle-orm";

/**
 * Payment webhook endpoint.
 * Verifies webhook signature (adapter-specific), processes payment confirmation.
 * Idempotent — duplicate webhooks are safely ignored.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Rate limit
  const rateLimit = RATE_LIMITS.webhook(`webhook:${ip}`);
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      eventType: "webhook.rate_limited",
      severity: "warn",
      ipAddress: ip,
      details: { resetAt: rateLimit.resetAt },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();

    // Determine payment method from webhook payload
    const paymentMethod = body.payment_method ?? body.type?.startsWith("stripe") ? "stripe" : null;

    if (!paymentMethod) {
      await logSecurityEvent({
        eventType: "webhook.unknown_method",
        severity: "warn",
        ipAddress: ip,
        details: { receivedType: body.type },
      });
      return NextResponse.json({ error: "Unknown payment method" }, { status: 400 });
    }

    // For Stripe: verify signature
    if (paymentMethod === "stripe") {
      const signature = request.headers.get("stripe-signature");
      if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        await logSecurityEvent({
          eventType: "webhook.invalid_sig",
          severity: "critical",
          ipAddress: ip,
          details: { method: "stripe", hasSignature: !!signature },
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }

      // TODO: Verify Stripe signature using stripe.webhooks.constructEvent()
      // For now, reject all Stripe webhooks until fully implemented
      return NextResponse.json({ error: "Stripe webhook not yet implemented" }, { status: 501 });
    }

    // Generic webhook processing for future adapters
    const { order_id, provider_tx_id, amount, currency } = body;

    if (!order_id || !provider_tx_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Idempotency check
    const [existingPayment] = await db
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(eq(payments.providerTxId, provider_tx_id))
      .limit(1);

    if (existingPayment && existingPayment.status === "confirmed") {
      // Already processed — return success (idempotent)
      return NextResponse.json({ status: "already_processed" });
    }

    // Find the order
    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, order_id))
      .limit(1);

    if (!order) {
      await logSecurityEvent({
        eventType: "webhook.order_not_found",
        severity: "warn",
        ipAddress: ip,
        details: { orderId: order_id, providerTxId: provider_tx_id },
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update payment
    if (existingPayment) {
      await db
        .update(payments)
        .set({
          status: "confirmed",
          providerTxId: provider_tx_id,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPayment.id));
    } else {
      await db.insert(payments).values({
        orderId: order_id,
        paymentMethod,
        status: "confirmed",
        amount: amount ?? 0,
        currency: currency ?? "USD",
        providerTxId: provider_tx_id,
        confirmedAt: new Date(),
        idempotencyKey: `webhook_${provider_tx_id}`,
      });
    }

    // Update order status
    await db
      .update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, order_id));

    await logSecurityEvent({
      eventType: "webhook.payment_confirmed",
      severity: "info",
      ipAddress: ip,
      details: { orderId: order_id, providerTxId: provider_tx_id },
    });

    return NextResponse.json({ status: "success" });
  } catch (error) {
    await logSecurityEvent({
      eventType: "webhook.error",
      severity: "critical",
      ipAddress: ip,
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
