"use server";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import { createCategorySchema, type CreateCategoryInput } from "@/schemas/product";
import { eq, and, asc, count, ne } from "drizzle-orm";
import type { ActionResult } from "@/types";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/auth-guard";
import { z } from "zod";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
}

/**
 * Get all categories for admin listing.
 */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      productCount: count(products.id),
      createdAt: categories.createdAt,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(
      categories.id,
      categories.name,
      categories.slug,
      categories.sortOrder,
      categories.isActive,
      categories.createdAt,
    )
    .orderBy(asc(categories.sortOrder));

  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}

/**
 * Create a new category.
 */
export async function createCategory(
  input: CreateCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, parsed.data.slug))
    .limit(1);

  if (existing) {
    return { success: false, error: "A category with this slug already exists" };
  }

  const [created] = await db
    .insert(categories)
    .values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    })
    .returning({ id: categories.id });

  await logAuditEvent({
    adminUserId: user.id,
    action: "category.create",
    entityType: "category",
    entityId: created.id,
    details: { name: parsed.data.name, slug: parsed.data.slug },
    ipAddress: ip,
  });

  return { success: true, data: { id: created.id } };
}

const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.string().uuid(),
});

/**
 * Update an existing category.
 */
export async function updateCategory(
  input: z.infer<typeof updateCategorySchema>,
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { id, ...updates } = parsed.data;

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Category not found" };
  }

  // If slug is being updated, check uniqueness
  if (updates.slug) {
    const [slugConflict] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, updates.slug), ne(categories.id, id)))
      .limit(1);
    if (slugConflict) {
      return { success: false, error: "A category with this slug already exists" };
    }
  }

  await db
    .update(categories)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(categories.id, id));

  await logAuditEvent({
    adminUserId: user.id,
    action: "category.update",
    entityType: "category",
    entityId: id,
    details: { updatedFields: Object.keys(updates) },
    ipAddress: ip,
  });

  return { success: true };
}

/**
 * Delete a category. Only allowed if no products reference it.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const [existing] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Category not found" };
  }

  // Check if any products reference this category
  const [{ productCount }] = await db
    .select({ productCount: count() })
    .from(products)
    .where(eq(products.categoryId, id));

  if (Number(productCount) > 0) {
    return {
      success: false,
      error: `Cannot delete category: ${productCount} products still reference it. Reassign or delete them first.`,
    };
  }

  await db.delete(categories).where(eq(categories.id, id));

  await logAuditEvent({
    adminUserId: user.id,
    action: "category.delete",
    entityType: "category",
    entityId: id,
    details: { name: existing.name },
    ipAddress: ip,
  });

  return { success: true };
}
