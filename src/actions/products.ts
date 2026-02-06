"use server";

import { db } from "@/db";
import { products, categories, inventoryItems } from "@/db/schema";
import { eq, and, asc, desc, sql, count } from "drizzle-orm";

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  imageUrl: string | null;
  price: number;
  currency: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  inStock: boolean;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

/**
 * Get active products for the public storefront.
 * Never exposes inventory counts — only boolean inStock.
 */
export async function getActiveProducts(opts?: {
  categorySlug?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "name";
  limit?: number;
  offset?: number;
}): Promise<{ products: PublicProduct[]; total: number }> {
  const { categorySlug, sort = "newest", limit = 20, offset = 0 } = opts ?? {};

  // Build conditions
  const conditions = [eq(products.status, "active")];

  if (categorySlug) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, categorySlug), eq(categories.isActive, true)))
      .limit(1);
    if (cat) {
      conditions.push(eq(products.categoryId, cat.id));
    }
  }

  // Sort order
  const orderBy = (() => {
    switch (sort) {
      case "price_asc":
        return asc(products.price);
      case "price_desc":
        return desc(products.price);
      case "name":
        return asc(products.name);
      case "newest":
      default:
        return desc(products.createdAt);
    }
  })();

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(and(...conditions));

  // Get products with category join
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
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Check stock for each product (boolean only)
  const productIds = rows.map((r) => r.id);
  const stockCounts =
    productIds.length > 0
      ? await db
          .select({
            productId: inventoryItems.productId,
            available: count(),
          })
          .from(inventoryItems)
          .where(
            and(
              sql`${inventoryItems.productId} IN ${productIds}`,
              eq(inventoryItems.status, "available"),
            ),
          )
          .groupBy(inventoryItems.productId)
      : [];

  const stockMap = new Map(stockCounts.map((s) => [s.productId, Number(s.available) > 0]));

  const result: PublicProduct[] = rows.map((r) => ({
    ...r,
    inStock: stockMap.get(r.id) ?? false,
  }));

  return { products: result, total: Number(total) };
}

/**
 * Get a single product by slug for the product detail page.
 */
export async function getProductBySlug(
  slug: string,
): Promise<PublicProduct | null> {
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
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active")))
    .limit(1);

  if (!row) return null;

  // Check stock (boolean only)
  const [stock] = await db
    .select({ available: count() })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.productId, row.id),
        eq(inventoryItems.status, "available"),
      ),
    );

  return {
    ...row,
    inStock: Number(stock?.available ?? 0) > 0,
  };
}

/**
 * Get active categories with product counts.
 */
export async function getCategories(): Promise<PublicCategory[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), eq(products.status, "active")),
    )
    .where(eq(categories.isActive, true))
    .groupBy(categories.id, categories.name, categories.slug, categories.sortOrder)
    .orderBy(asc(categories.sortOrder));

  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}

/**
 * Get featured products for the home page.
 */
export async function getFeaturedProducts(
  limit: number = 6,
): Promise<PublicProduct[]> {
  const { products: featured } = await getActiveProducts({
    sort: "newest",
    limit,
  });
  return featured;
}
