"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  payments,
  inventoryItems,
  deliveryEvents,
} from "@/db/schema";
import { requireAdmin, getClientIp } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import { eq, and, desc, count, sql } from "drizzle-orm";
import type { ActionResult } from "@/types";
import { headers } from "next/headers";

export interface AdminOrder {
  id: string;
  orderCode: string;
  customerEmail: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
  fulfilledAt: Date | null;
}

export interface AdminOrderDetail extends AdminOrder {
  subtotal: number;
  ipAddress: string | null;
  notes: string | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  paymentHistory: {
    id: string;
    method: string;
    status: string;
    amount: number;
    currency: string;
    providerTxId: string | null;
    confirmedAt: Date | null;
    createdAt: Date;
  }[];
  deliveries: {
    id: string;
    token: string;
    revealedAt: Date | null;
    revealCount: number;
    maxReveals: number;
    tokenExpiresAt: Date;
  }[];
}

/**
 * Get paginated list of orders for admin.
 */
export async function getOrders(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: AdminOrder[]; total: number }> {
  await requireAdmin();

  const { status, limit = 30, offset = 0 } = opts ?? {};

  const conditions = status ? eq(orders.status, status) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(conditions);

  const rows = await db
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
    .where(conditions)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return { orders: rows, total: Number(total) };
}

/**
 * Get full order detail for admin view.
 */
export async function getOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  await requireAdmin();

  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      customerEmail: orders.customerEmail,
      status: orders.status,
      subtotal: orders.subtotal,
      total: orders.total,
      currency: orders.currency,
      ipAddress: orders.ipAddress,
      notes: orders.notes,
      fulfilledAt: orders.fulfilledAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  const paymentHistory = await db
    .select({
      id: payments.id,
      method: payments.paymentMethod,
      status: payments.status,
      amount: payments.amount,
      currency: payments.currency,
      providerTxId: payments.providerTxId,
      confirmedAt: payments.confirmedAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.orderId, id))
    .orderBy(desc(payments.createdAt));

  const deliveries = await db
    .select({
      id: deliveryEvents.id,
      token: deliveryEvents.deliveryToken,
      revealedAt: deliveryEvents.revealedAt,
      revealCount: deliveryEvents.revealCount,
      maxReveals: deliveryEvents.maxReveals,
      tokenExpiresAt: deliveryEvents.tokenExpiresAt,
    })
    .from(deliveryEvents)
    .where(eq(deliveryEvents.orderId, id));

  return { ...order, items, paymentHistory, deliveries };
}

/**
 * Admin marks an order as paid (for manual transfer).
 */
export async function markOrderPaid(orderId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "pending") {
    return { success: false, error: `Cannot mark as paid: order is ${order.status}` };
  }

  await db.transaction(async (tx) => {
    // Update order status
    await tx
      .update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    // Update or create payment as confirmed
    const [existingPayment] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (existingPayment) {
      await tx
        .update(payments)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPayment.id));
    } else {
      // Create a manual payment record
      await tx.insert(payments).values({
        orderId,
        paymentMethod: "manual_transfer",
        status: "confirmed",
        amount: 0, // will be set from order total
        currency: "USD",
        confirmedAt: new Date(),
        confirmedBy: user.id,
        idempotencyKey: `admin_confirm_${orderId}_${Date.now()}`,
      });
    }
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "order.mark_paid",
    entityType: "order",
    entityId: orderId,
    details: {},
    ipAddress: ip,
  });

  return { success: true };
}

/**
 * Admin refunds an order:
 * - Updates order status to refunded
 * - Updates payment status to refunded
 * - Releases reserved/sold inventory back to available
 * - Invalidates delivery tokens
 */
export async function refundOrder(orderId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status === "refunded" || order.status === "cancelled") {
    return { success: false, error: `Order is already ${order.status}` };
  }

  await db.transaction(async (tx) => {
    // Update order status
    await tx
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    // Update payment status
    await tx
      .update(payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(payments.orderId, orderId));

    // Get order item IDs
    const items = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const itemIds = items.map((i) => i.id);

    // Release inventory items back to available
    if (itemIds.length > 0) {
      await tx.execute(sql`
        UPDATE inventory_items
        SET status = 'available',
            order_item_id = NULL,
            reserved_at = NULL,
            reservation_expires_at = NULL,
            sold_at = NULL,
            updated_at = NOW()
        WHERE order_item_id IN ${itemIds}
          AND status IN ('reserved', 'sold')
      `);
    }

    // Invalidate delivery tokens
    await tx
      .update(deliveryEvents)
      .set({ maxReveals: 0 })
      .where(eq(deliveryEvents.orderId, orderId));
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "order.refund",
    entityType: "order",
    entityId: orderId,
    details: { previousStatus: order.status },
    ipAddress: ip,
  });

  return { success: true };
}
