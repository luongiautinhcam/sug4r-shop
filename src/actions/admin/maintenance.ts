"use server";

import { db } from "@/db";
import { inventoryItems, deliveryEvents } from "@/db/schema";
import { requireAdmin, getClientIp } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";

/**
 * Cleans up expired inventory reservations.
 * Finds items where status = 'reserved' AND reservation_expires_at < now(),
 * and sets them back to 'available'.
 */
export async function cleanupExpiredReservations(): Promise<
  ActionResult<{ released: number }>
> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const result = await db.execute(sql`
    UPDATE inventory_items
    SET status = 'available',
        order_item_id = NULL,
        reserved_at = NULL,
        reservation_expires_at = NULL,
        updated_at = NOW()
    WHERE status = 'reserved'
      AND reservation_expires_at < NOW()
    RETURNING id
  `);

  const released = (result as unknown as { rows: unknown[] }).rows?.length
    ?? (Array.isArray(result) ? result.length : 0);

  if (released > 0) {
    await logAuditEvent({
      adminUserId: user.id,
      action: "maintenance.cleanup_reservations",
      entityType: "inventory",
      details: { releasedCount: released },
      ipAddress: ip,
    });
  }

  return { success: true, data: { released } };
}

/**
 * Cleans up expired delivery tokens by setting max_reveals to 0.
 * Targets unrevealed tokens past their expiry.
 */
export async function cleanupExpiredDeliveryTokens(): Promise<
  ActionResult<{ expired: number }>
> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const result = await db.execute(sql`
    UPDATE delivery_events
    SET max_reveals = 0
    WHERE token_expires_at < NOW()
      AND reveal_count = 0
      AND max_reveals > 0
    RETURNING id
  `);

  const expired = (result as unknown as { rows: unknown[] }).rows?.length
    ?? (Array.isArray(result) ? result.length : 0);

  if (expired > 0) {
    await logAuditEvent({
      adminUserId: user.id,
      action: "maintenance.cleanup_delivery_tokens",
      entityType: "delivery",
      details: { expiredCount: expired },
      ipAddress: ip,
    });
  }

  return { success: true, data: { expired } };
}
