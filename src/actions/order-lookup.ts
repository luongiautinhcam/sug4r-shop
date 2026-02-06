"use server";

import { db } from "@/db";
import { orders, orderItems, payments, deliveryEvents } from "@/db/schema";
import { orderLookupSchema, type OrderLookupInput } from "@/schemas/order";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/auth-guard";
import type { ActionResult } from "@/types";

export interface OrderLookupResult {
  orderCode: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
  fulfilledAt: Date | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  payment: {
    method: string;
    status: string;
  } | null;
  deliveryLinks: {
    token: string;
    revealed: boolean;
    expired: boolean;
  }[];
}

/**
 * Look up an order by order code + email.
 * Email acts as the authentication factor — no login required.
 * Never returns encrypted credentials.
 */
export async function lookupOrderAction(
  input: OrderLookupInput,
): Promise<ActionResult<OrderLookupResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList) ?? "unknown";

  // Validate
  const parsed = orderLookupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { orderCode, email } = parsed.data;

  // Rate limit
  const rateLimit = RATE_LIMITS.general(`order_lookup:${ip}`);
  if (!rateLimit.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  // Find order by code + email match
  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      customerEmail: orders.customerEmail,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
      fulfilledAt: orders.fulfilledAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.orderCode, orderCode),
        eq(orders.customerEmail, email.toLowerCase()),
      ),
    )
    .limit(1);

  if (!order) {
    // Generic error — no indication of whether code exists (prevents enumeration)
    return { success: false, error: "Order not found. Please check your order code and email." };
  }

  // Get order items
  const items = await db
    .select({
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  // Get latest payment
  const [payment] = await db
    .select({
      method: payments.paymentMethod,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .limit(1);

  // Get delivery links (if fulfilled)
  const deliveries = await db
    .select({
      token: deliveryEvents.deliveryToken,
      revealedAt: deliveryEvents.revealedAt,
      tokenExpiresAt: deliveryEvents.tokenExpiresAt,
    })
    .from(deliveryEvents)
    .where(eq(deliveryEvents.orderId, order.id));

  const now = new Date();
  const deliveryLinks = deliveries.map((d) => ({
    token: d.token,
    revealed: d.revealedAt !== null,
    expired: d.tokenExpiresAt < now,
  }));

  return {
    success: true,
    data: {
      orderCode: order.orderCode,
      status: order.status,
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt,
      fulfilledAt: order.fulfilledAt,
      items,
      payment: payment ?? null,
      deliveryLinks,
    },
  };
}
