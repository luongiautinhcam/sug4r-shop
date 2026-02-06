"use server";

import { db } from "@/db";
import { products, inventoryItems, orders, orderItems } from "@/db/schema";
import { checkoutSchema, type CheckoutInput } from "@/schemas/order";
import { generateOrderCode } from "@/lib/order-code";
import { getPaymentAdapter } from "@/lib/payments";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-events";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { eq, and, asc, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/auth-guard";
import type { ActionResult } from "@/types";

export interface CheckoutResult {
  orderCode: string;
  total: number;
  currency: string;
  paymentInstructions?: string;
  redirectUrl?: string;
}

/**
 * Creates an order with inventory reservation inside a transaction.
 *
 * Flow:
 * 1. Validate input with Zod
 * 2. Rate limit by IP
 * 3. Verify product exists & is active
 * 4. Check inventory availability (boolean only)
 * 5. Transaction: create order → order items → reserve inventory → create payment
 * 6. Return order code + payment instructions
 */
export async function createOrderAction(
  input: CheckoutInput,
): Promise<ActionResult<CheckoutResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList) ?? "unknown";
  const ua = headersList.get("user-agent") ?? undefined;

  // 1. Validate
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { email, productId, quantity, paymentMethod } = parsed.data;

  // 2. Rate limit
  const rateLimit = RATE_LIMITS.checkout(`checkout:${ip}`);
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      eventType: "rate_limit.checkout",
      severity: "warn",
      ipAddress: ip,
      userAgent: ua,
      details: { resetAt: rateLimit.resetAt },
    });
    return { success: false, error: "Too many requests. Please try again later." };
  }

  // 3. Verify product
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      currency: products.currency,
      status: products.status,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product || product.status !== "active") {
    return { success: false, error: "Product not found or unavailable." };
  }

  // 4. Check inventory (boolean only — no count leak)
  const [stockCheck] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.productId, productId),
        eq(inventoryItems.status, "available"),
      ),
    )
    .limit(1);

  if (!stockCheck) {
    return { success: false, error: "This product is currently out of stock." };
  }

  // 5. Transaction: create order + reserve inventory + create payment
  const unitPrice = product.price;
  const totalPrice = unitPrice * quantity;
  const orderCode = generateOrderCode();

  try {
    const result = await db.transaction(async (tx) => {
      // 5a. Create order
      const [order] = await tx
        .insert(orders)
        .values({
          orderCode,
          customerEmail: email,
          status: "pending",
          subtotal: totalPrice,
          total: totalPrice,
          currency: product.currency,
          ipAddress: ip,
          userAgent: ua,
        })
        .returning({ id: orders.id });

      // 5b. Create order item
      const [orderItem] = await tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice,
          totalPrice,
        })
        .returning({ id: orderItems.id });

      // 5c. Reserve inventory items (FOR UPDATE SKIP LOCKED prevents deadlocks)
      const reservedItems = await tx.execute(sql`
        UPDATE inventory_items
        SET
          status = 'reserved',
          order_item_id = ${orderItem.id},
          reserved_at = NOW(),
          reservation_expires_at = NOW() + INTERVAL '15 minutes',
          updated_at = NOW()
        WHERE id IN (
          SELECT id FROM inventory_items
          WHERE product_id = ${product.id}
            AND status = 'available'
          ORDER BY created_at ASC
          LIMIT ${quantity}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id
      `);

      const reservedCount = (reservedItems as unknown as { rows: unknown[] }).rows?.length
        ?? (Array.isArray(reservedItems) ? reservedItems.length : 0);

      if (reservedCount < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // 5d. Create payment via adapter
      const adapter = getPaymentAdapter(paymentMethod);
      const paymentResult = await adapter.createPaymentIntent({
        id: order.id,
        orderCode,
        total: totalPrice,
        currency: product.currency,
        customerEmail: email,
      });

      return {
        orderCode,
        total: totalPrice,
        currency: product.currency,
        paymentInstructions: paymentResult.instructions,
        redirectUrl: paymentResult.redirectUrl,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return { success: false, error: "Not enough stock available. Please reduce quantity." };
    }

    await logSecurityEvent({
      eventType: "checkout.error",
      severity: "warn",
      ipAddress: ip,
      userAgent: ua,
      details: {
        productId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return { success: false, error: "An error occurred while processing your order. Please try again." };
  }
}
