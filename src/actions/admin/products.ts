"use server";

import { db } from "@/db";
import { products, categories, inventoryItems } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/schemas/product";
import { eq, and, asc, desc, sql, count, ne } from "drizzle-orm";
import type { ActionResult } from "@/types";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/auth-guard";

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  imageUrl: string | null;
  price: number;
  currency: string;
  status: string;
  sortOrder: number;
  categoryId: string | null;
  categoryName: string | null;
  availableCount: number;
  totalCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all products for admin listing (includes inventory counts).
 */
export async function getAdminProducts(opts?: {
  status?: string;
  categoryId?: string;
  sort?: "name" | "price" | "newest" | "status";
  limit?: number;
  offset?: number;
}): Promise<{ products: AdminProduct[]; total: number }> {
  await requireAdmin();

  const { status, categoryId, sort = "newest", limit = 50, offset = 0 } = opts ?? {};

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(products.status, status));
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy = (() => {
    switch (sort) {
      case "name": return asc(products.name);
      case "price": return asc(products.price);
      case "status": return asc(products.status);
      case "newest":
      default: return desc(products.createdAt);
    }
  })();

  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(whereClause);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      shortDesc: products.shortDesc,
      imageUrl: products.imageUrl,
      price: products.price,
      currency: products.currency,
      status: products.status,
      sortOrder: products.sortOrder,
      categoryId: products.categoryId,
      categoryName: categories.name,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get inventory counts per product
  const productIds = rows.map((r) => r.id);
  const inventoryCounts =
    productIds.length > 0
      ? await db
          .select({
            productId: inventoryItems.productId,
            status: inventoryItems.status,
            cnt: count(),
          })
          .from(inventoryItems)
          .where(sql`${inventoryItems.productId} IN ${productIds}`)
          .groupBy(inventoryItems.productId, inventoryItems.status)
      : [];

  const countMap = new Map<string, { available: number; total: number }>();
  for (const row of inventoryCounts) {
    const entry = countMap.get(row.productId) ?? { available: 0, total: 0 };
    const c = Number(row.cnt);
    entry.total += c;
    if (row.status === "available") entry.available = c;
    countMap.set(row.productId, entry);
  }

  const result: AdminProduct[] = rows.map((r) => ({
    ...r,
    availableCount: countMap.get(r.id)?.available ?? 0,
    totalCount: countMap.get(r.id)?.total ?? 0,
  }));

  return { products: result, total: Number(total) };
}

/**
 * Get a single product by ID for admin editing.
 */
export async function getAdminProductById(id: string): Promise<AdminProduct | null> {
  await requireAdmin();

  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      shortDesc: products.shortDesc,
      imageUrl: products.imageUrl,
      price: products.price,
      currency: products.currency,
      status: products.status,
      sortOrder: products.sortOrder,
      categoryId: products.categoryId,
      categoryName: categories.name,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);

  if (!row) return null;

  // Get inventory counts
  const inventoryCounts = await db
    .select({
      status: inventoryItems.status,
      cnt: count(),
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.productId, id))
    .groupBy(inventoryItems.status);

  let available = 0;
  let total = 0;
  for (const c of inventoryCounts) {
    const n = Number(c.cnt);
    total += n;
    if (c.status === "available") available = n;
  }

  return { ...row, availableCount: available, totalCount: total };
}

/**
 * Create a new product.
 */
export async function createProduct(
  input: CreateProductInput,
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, parsed.data.slug))
    .limit(1);

  if (existing) {
    return { success: false, error: "A product with this slug already exists" };
  }

  const [created] = await db
    .insert(products)
    .values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      categoryId: parsed.data.categoryId ?? null,
      description: parsed.data.description ?? null,
      shortDesc: parsed.data.shortDesc ?? null,
      imageUrl: parsed.data.imageUrl || null,
      price: parsed.data.price,
      currency: parsed.data.currency,
      status: parsed.data.status,
      sortOrder: parsed.data.sortOrder,
    })
    .returning({ id: products.id });

  await logAuditEvent({
    adminUserId: user.id,
    action: "product.create",
    entityType: "product",
    entityId: created.id,
    details: { name: parsed.data.name, slug: parsed.data.slug, status: parsed.data.status },
    ipAddress: ip,
  });

  return { success: true, data: { id: created.id } };
}

/**
 * Update an existing product.
 */
export async function updateProduct(
  input: UpdateProductInput,
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { id, ...updates } = parsed.data;

  // Check product exists
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  // If slug is being updated, check uniqueness
  if (updates.slug) {
    const [slugConflict] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.slug, updates.slug), ne(products.id, id)))
      .limit(1);
    if (slugConflict) {
      return { success: false, error: "A product with this slug already exists" };
    }
  }

  await db
    .update(products)
    .set({
      ...updates,
      imageUrl: updates.imageUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  await logAuditEvent({
    adminUserId: user.id,
    action: "product.update",
    entityType: "product",
    entityId: id,
    details: { updatedFields: Object.keys(updates) },
    ipAddress: ip,
  });

  return { success: true };
}

/**
 * Toggle product status (draft/active/archived).
 */
export async function toggleProductStatus(
  id: string,
  status: "draft" | "active" | "archived",
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const [existing] = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  await db
    .update(products)
    .set({ status, updatedAt: new Date() })
    .where(eq(products.id, id));

  await logAuditEvent({
    adminUserId: user.id,
    action: "product.status_change",
    entityType: "product",
    entityId: id,
    details: { from: existing.status, to: status },
    ipAddress: ip,
  });

  return { success: true };
}

/**
 * Delete (archive) a product. Soft delete only.
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  return toggleProductStatus(id, "archived");
}
