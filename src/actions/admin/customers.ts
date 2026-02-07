"use server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { sql, desc, eq, ilike } from "drizzle-orm";

export interface CustomerSummary {
  email: string;
  orderCount: number;
  totalSpent: number;
  currency: string;
  lastOrderAt: Date;
}

export interface CustomerOrder {
  id: string;
  orderCode: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
}

/**
 * Get paginated list of distinct customers with aggregated stats.
 */
export async function getCustomers(opts?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ customers: CustomerSummary[]; total: number }> {
  await requireAdmin();

  const { search, limit = 30, offset = 0 } = opts ?? {};

  const searchCondition = search
    ? ilike(orders.customerEmail, `%${search}%`)
    : undefined;

  // Count distinct customers
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${orders.customerEmail})` })
    .from(orders)
    .where(searchCondition);

  // Aggregated customer list
  const rows = await db
    .select({
      email: orders.customerEmail,
      orderCount: sql<number>`COUNT(*)::int`,
      totalSpent: sql<number>`SUM(${orders.total})::int`,
      currency: sql<string>`MAX(${orders.currency})`,
      lastOrderAt: sql<Date>`MAX(${orders.createdAt})`,
    })
    .from(orders)
    .where(searchCondition)
    .groupBy(orders.customerEmail)
    .orderBy(desc(sql`MAX(${orders.createdAt})`))
    .limit(limit)
    .offset(offset);

  return {
    customers: rows.map((r) => ({
      ...r,
      totalSpent: Number(r.totalSpent),
      orderCount: Number(r.orderCount),
    })),
    total: Number(total),
  };
}

/**
 * Get all orders for a specific customer email.
 */
export async function getCustomerOrders(
  email: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ orders: CustomerOrder[]; total: number }> {
  await requireAdmin();

  const { limit = 30, offset = 0 } = opts ?? {};

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(orders)
    .where(eq(orders.customerEmail, email));

  const rows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerEmail, email))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return { orders: rows, total: Number(total) };
}
