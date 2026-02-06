"use server";

import { db } from "@/db";
import { inventoryItems, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { importInventorySchema, type ImportInventoryInput } from "@/schemas/inventory";
import { eq, and, asc, desc, sql, count } from "drizzle-orm";
import type { ActionResult } from "@/types";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/auth-guard";

export interface AdminInventoryItem {
  id: string;
  productId: string;
  productName: string;
  status: string;
  encryptionKeyId: string;
  orderItemId: string | null;
  reservedAt: Date | null;
  soldAt: Date | null;
  createdAt: Date;
}

export interface InventoryStats {
  productId: string;
  available: number;
  reserved: number;
  sold: number;
  revoked: number;
  total: number;
}

/**
 * Import inventory items (credentials) for a product.
 * Each credential is encrypted individually before storage.
 * NEVER logs the credential plaintext.
 */
export async function importInventoryItems(
  input: ImportInventoryInput,
): Promise<ActionResult<{ imported: number }>> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = importInventorySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  // Verify product exists
  const [product] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, parsed.data.productId))
    .limit(1);

  if (!product) {
    return { success: false, error: "Product not found" };
  }

  // Encrypt and insert each credential
  const values = parsed.data.credentials.map((credential) => {
    const encrypted = encrypt(credential);
    return {
      productId: parsed.data.productId,
      encryptedPayload: encrypted.encrypted,
      encryptionIv: encrypted.iv,
      encryptionTag: encrypted.tag,
      encryptionKeyId: encrypted.keyId,
      status: "available" as const,
    };
  });

  // Batch insert
  await db.insert(inventoryItems).values(values);

  await logAuditEvent({
    adminUserId: user.id,
    action: "inventory.import",
    entityType: "inventory",
    entityId: product.id,
    details: {
      productName: product.name,
      count: values.length,
      // NEVER log credentials
    },
    ipAddress: ip,
  });

  return { success: true, data: { imported: values.length } };
}

/**
 * Get inventory items for admin listing.
 * Never returns decrypted payloads.
 */
export async function getInventoryItems(opts?: {
  productId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminInventoryItem[]; total: number }> {
  await requireAdmin();

  const { productId, status, limit = 50, offset = 0 } = opts ?? {};

  const conditions: ReturnType<typeof eq>[] = [];
  if (productId) conditions.push(eq(inventoryItems.productId, productId));
  if (status) conditions.push(eq(inventoryItems.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(inventoryItems)
    .where(whereClause);

  const rows = await db
    .select({
      id: inventoryItems.id,
      productId: inventoryItems.productId,
      productName: products.name,
      status: inventoryItems.status,
      encryptionKeyId: inventoryItems.encryptionKeyId,
      orderItemId: inventoryItems.orderItemId,
      reservedAt: inventoryItems.reservedAt,
      soldAt: inventoryItems.soldAt,
      createdAt: inventoryItems.createdAt,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(inventoryItems.productId, products.id))
    .where(whereClause)
    .orderBy(desc(inventoryItems.createdAt))
    .limit(limit)
    .offset(offset);

  return { items: rows, total: Number(total) };
}

/**
 * Get inventory statistics per product.
 */
export async function getInventoryStats(
  productId?: string,
): Promise<InventoryStats[]> {
  await requireAdmin();

  const conditions = productId
    ? eq(inventoryItems.productId, productId)
    : undefined;

  const rows = await db
    .select({
      productId: inventoryItems.productId,
      status: inventoryItems.status,
      cnt: count(),
    })
    .from(inventoryItems)
    .where(conditions)
    .groupBy(inventoryItems.productId, inventoryItems.status);

  // Aggregate by product
  const statsMap = new Map<string, InventoryStats>();
  for (const row of rows) {
    const entry = statsMap.get(row.productId) ?? {
      productId: row.productId,
      available: 0,
      reserved: 0,
      sold: 0,
      revoked: 0,
      total: 0,
    };
    const c = Number(row.cnt);
    entry.total += c;
    if (row.status === "available") entry.available = c;
    else if (row.status === "reserved") entry.reserved = c;
    else if (row.status === "sold") entry.sold = c;
    else if (row.status === "revoked") entry.revoked = c;
    statsMap.set(row.productId, entry);
  }

  return Array.from(statsMap.values());
}

/**
 * Revoke an inventory item (mark as unusable).
 */
export async function revokeInventoryItem(id: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const [item] = await db
    .select({
      id: inventoryItems.id,
      status: inventoryItems.status,
      productId: inventoryItems.productId,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);

  if (!item) {
    return { success: false, error: "Inventory item not found" };
  }

  if (item.status === "sold") {
    return { success: false, error: "Cannot revoke a sold item" };
  }

  await db
    .update(inventoryItems)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(inventoryItems.id, id));

  await logAuditEvent({
    adminUserId: user.id,
    action: "inventory.revoke",
    entityType: "inventory",
    entityId: id,
    details: { productId: item.productId, previousStatus: item.status },
    ipAddress: ip,
  });

  return { success: true };
}
