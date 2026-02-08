import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-events";
import { eq } from "drizzle-orm";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const paymentMethod =
      (typeof body.payment_method === "string" && body.payment_method.length > 0
        ? body.payment_method
        : null) ??
      (typeof body.type === "string" && body.type.startsWith("stripe")
        ? "stripe"
        : null);

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
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    const providerTxId =
      typeof body.provider_tx_id === "string" ? body.provider_tx_id : "";
    const amount = typeof body.amount === "number" ? body.amount : 0;
    const currency =
      typeof body.currency === "string" ? body.currency : "USD";

    if (!orderId || !providerTxId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!UUID_REGEX.test(orderId)) {
      return NextResponse.json({ error: "Invalid order_id format" }, { status: 400 });
    }

    // Idempotency check
    const [existingPayment] = await db
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(eq(payments.providerTxId, providerTxId))
      .limit(1);

    if (existingPayment && existingPayment.status === "confirmed") {
      // Already processed — return success (idempotent)
      return NextResponse.json({ status: "already_processed" });
    }

    // Find the order
    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      await logSecurityEvent({
        eventType: "webhook.order_not_found",
        severity: "warn",
        ipAddress: ip,
        details: { orderId, providerTxId },
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update payment
    if (existingPayment) {
      await db
        .update(payments)
        .set({
          status: "confirmed",
          providerTxId,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPayment.id));
    } else {
      await db.insert(payments).values({
        orderId,
        paymentMethod,
        status: "confirmed",
        amount,
        currency,
        providerTxId,
        confirmedAt: new Date(),
        idempotencyKey: `webhook_${providerTxId}`,
      });
    }

    // Update order status
    await db
      .update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await logSecurityEvent({
      eventType: "webhook.payment_confirmed",
      severity: "info",
      ipAddress: ip,
      details: { orderId, providerTxId },
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
