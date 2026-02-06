"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  inventoryItems,
  deliveryEvents,
} from "@/db/schema";
import { requireAdmin, getClientIp } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import { createDeliveryEvent } from "@/lib/delivery";
import { eq, and, sql } from "drizzle-orm";
import type { ActionResult } from "@/types";
import { headers } from "next/headers";

export interface FulfillResult {
  deliveryTokens: string[];
}

/**
 * Fulfills a paid order:
 * 1. Verify order is in "paid" status
 * 2. For each order item × quantity, find a reserved (or available) inventory item
 * 3. Mark inventory as "sold"
 * 4. Create delivery events with unique tokens
 * 5. Update order status to "fulfilled"
 */
export async function fulfillOrder(
  orderId: string,
): Promise<ActionResult<FulfillResult>> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Verify order exists and is paid
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status !== "paid") {
    return {
      success: false,
      error: `Cannot fulfill: order status is "${order.status}" (must be "paid")`,
    };
  }

  // Get order items
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    return { success: false, error: "Order has no items" };
  }

  const deliveryTokens: string[] = [];

  await db.transaction(async (tx) => {
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        // Find a reserved inventory item for this order item, or fall back to available
        const [inv] = await tx.execute(sql`
          SELECT id FROM inventory_items
          WHERE product_id = ${item.productId}
            AND (
              (status = 'reserved' AND order_item_id = ${item.id})
              OR status = 'available'
            )
          ORDER BY
            CASE WHEN status = 'reserved' AND order_item_id = ${item.id} THEN 0 ELSE 1 END,
            created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `);

        const invRow = inv as unknown as { id: string } | undefined;
        if (!invRow?.id) {
          throw new Error(
            `Insufficient inventory for "${item.productName}". Fulfillment aborted.`,
          );
        }

        // Mark as sold
        await tx
          .update(inventoryItems)
          .set({
            status: "sold",
            orderItemId: item.id,
            soldAt: new Date(),
            reservedAt: null,
            reservationExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, invRow.id));

        // Create delivery event
        const token = await createDeliveryEvent(orderId, invRow.id);
        deliveryTokens.push(token);
      }
    }

    // Update order to fulfilled
    await tx
      .update(orders)
      .set({
        status: "fulfilled",
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "order.fulfill",
    entityType: "order",
    entityId: orderId,
    details: { deliveryCount: deliveryTokens.length },
    ipAddress: ip,
  });

  return { success: true, data: { deliveryTokens } };
}

/**
 * Gets delivery links for an order (admin view).
 */
export async function getDeliveryLinks(orderId: string): Promise<
  {
    id: string;
    token: string;
    revealedAt: Date | null;
    revealCount: number;
    maxReveals: number;
    tokenExpiresAt: Date;
    inventoryItemId: string;
  }[]
> {
  await requireAdmin();

  return db
    .select({
      id: deliveryEvents.id,
      token: deliveryEvents.deliveryToken,
      revealedAt: deliveryEvents.revealedAt,
      revealCount: deliveryEvents.revealCount,
      maxReveals: deliveryEvents.maxReveals,
      tokenExpiresAt: deliveryEvents.tokenExpiresAt,
      inventoryItemId: deliveryEvents.inventoryItemId,
    })
    .from(deliveryEvents)
    .where(eq(deliveryEvents.orderId, orderId));
}
