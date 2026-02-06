import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { deliveryEvents, inventoryItems } from "@/db/schema";
import { decrypt } from "./crypto";
import { logSecurityEvent } from "./security-events";
import {
  DELIVERY_TOKEN_EXPIRY_HOURS,
  DELIVERY_MAX_REVEALS,
} from "./constants";
import { eq, and, sql } from "drizzle-orm";

/**
 * Generates a 32-byte URL-safe base64 delivery token.
 */
export function generateDeliveryToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates a delivery event for a fulfilled inventory item.
 * Returns the delivery token for the customer.
 */
export async function createDeliveryEvent(
  orderId: string,
  inventoryItemId: string,
  expiresInHours: number = DELIVERY_TOKEN_EXPIRY_HOURS,
): Promise<string> {
  const token = generateDeliveryToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await db.insert(deliveryEvents).values({
    orderId,
    inventoryItemId,
    deliveryToken: token,
    tokenExpiresAt: expiresAt,
    maxReveals: DELIVERY_MAX_REVEALS,
  });

  return token;
}

export interface DeliveryCheckResult {
  valid: boolean;
  status: "ready" | "revealed" | "expired" | "not_found";
  productName?: string;
}

/**
 * Checks a delivery token's validity without revealing the credential.
 */
export async function checkDeliveryToken(
  token: string,
): Promise<DeliveryCheckResult> {
  const [event] = await db
    .select({
      id: deliveryEvents.id,
      revealCount: deliveryEvents.revealCount,
      maxReveals: deliveryEvents.maxReveals,
      tokenExpiresAt: deliveryEvents.tokenExpiresAt,
      inventoryItemId: deliveryEvents.inventoryItemId,
    })
    .from(deliveryEvents)
    .where(eq(deliveryEvents.deliveryToken, token))
    .limit(1);

  if (!event) {
    return { valid: false, status: "not_found" };
  }

  // Get product name via inventory item
  const [item] = await db.execute(sql`
    SELECT p.name as product_name
    FROM inventory_items i
    JOIN products p ON p.id = i.product_id
    WHERE i.id = ${event.inventoryItemId}
    LIMIT 1
  `);

  const productName = (item as unknown as { product_name?: string })?.product_name ?? "Unknown Product";

  if (new Date() > event.tokenExpiresAt) {
    return { valid: false, status: "expired", productName };
  }

  if (event.revealCount >= event.maxReveals) {
    return { valid: false, status: "revealed", productName };
  }

  return { valid: true, status: "ready", productName };
}

export interface RevealResult {
  success: boolean;
  credential?: string;
  error?: string;
}

/**
 * Reveals a delivery credential (view-once).
 * Decrypts the inventory item payload and marks the delivery as revealed.
 * This is the ONLY place credentials are decrypted for customer delivery.
 */
export async function revealDelivery(
  token: string,
  ipAddress?: string,
): Promise<RevealResult> {
  // Find the delivery event
  const [event] = await db
    .select({
      id: deliveryEvents.id,
      revealCount: deliveryEvents.revealCount,
      maxReveals: deliveryEvents.maxReveals,
      tokenExpiresAt: deliveryEvents.tokenExpiresAt,
      inventoryItemId: deliveryEvents.inventoryItemId,
      orderId: deliveryEvents.orderId,
    })
    .from(deliveryEvents)
    .where(eq(deliveryEvents.deliveryToken, token))
    .limit(1);

  if (!event) {
    await logSecurityEvent({
      eventType: "delivery.not_found",
      severity: "warn",
      ipAddress,
      details: { tokenPrefix: token.slice(0, 8) },
    });
    return { success: false, error: "Delivery link not found." };
  }

  // Check expiration
  if (new Date() > event.tokenExpiresAt) {
    await logSecurityEvent({
      eventType: "delivery.expired",
      severity: "info",
      ipAddress,
      details: { deliveryId: event.id },
    });
    return { success: false, error: "This delivery link has expired." };
  }

  // Check reveal limit
  if (event.revealCount >= event.maxReveals) {
    await logSecurityEvent({
      eventType: "delivery.already_revealed",
      severity: "warn",
      ipAddress,
      details: { deliveryId: event.id },
    });
    return {
      success: false,
      error: "This credential has already been revealed and cannot be shown again.",
    };
  }

  // Get the inventory item's encrypted payload
  const [item] = await db
    .select({
      encryptedPayload: inventoryItems.encryptedPayload,
      encryptionIv: inventoryItems.encryptionIv,
      encryptionTag: inventoryItems.encryptionTag,
      encryptionKeyId: inventoryItems.encryptionKeyId,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, event.inventoryItemId))
    .limit(1);

  if (!item) {
    return { success: false, error: "Inventory item not found." };
  }

  // Decrypt the credential
  let credential: string;
  try {
    credential = decrypt({
      encrypted: item.encryptedPayload,
      iv: item.encryptionIv,
      tag: item.encryptionTag,
      keyId: item.encryptionKeyId,
    });
  } catch {
    await logSecurityEvent({
      eventType: "delivery.decrypt_error",
      severity: "critical",
      ipAddress,
      details: { deliveryId: event.id, inventoryItemId: event.inventoryItemId },
    });
    return { success: false, error: "Failed to decrypt credential. Please contact support." };
  }

  // Mark as revealed (atomic update with reveal_count check to prevent race)
  const updated = await db.execute(sql`
    UPDATE delivery_events
    SET reveal_count = reveal_count + 1,
        revealed_at = NOW(),
        revealed_ip = ${ipAddress ?? null}
    WHERE id = ${event.id}
      AND reveal_count < max_reveals
    RETURNING id
  `);

  const wasUpdated = (updated as unknown as { rows: unknown[] }).rows?.length > 0
    || (Array.isArray(updated) && updated.length > 0);

  if (!wasUpdated) {
    // Race condition — another request revealed it first
    return {
      success: false,
      error: "This credential has already been revealed and cannot be shown again.",
    };
  }

  await logSecurityEvent({
    eventType: "delivery.revealed",
    severity: "info",
    ipAddress,
    details: { deliveryId: event.id, orderId: event.orderId },
  });

  return { success: true, credential };
}

/**
 * Revokes a delivery token by setting max_reveals to 0.
 */
export async function revokeDeliveryToken(token: string): Promise<void> {
  await db
    .update(deliveryEvents)
    .set({ maxReveals: 0 })
    .where(eq(deliveryEvents.deliveryToken, token));
}
