"use server";

import { db } from "@/db";
import {
  orders,
  inventoryItems,
  products,
  securityEvents,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { eq, sql, desc, and, gte } from "drizzle-orm";

export interface DashboardKPIs {
  revenue: {
    today: number;
    week: number;
    month: number;
    allTime: number;
    currency: string;
  };
  orders: {
    total: number;
    pending: number;
    paid: number;
    fulfilled: number;
    refunded: number;
  };
  lowStockProducts: {
    id: string;
    name: string;
    available: number;
  }[];
  recentOrders: {
    id: string;
    orderCode: string;
    customerEmail: string;
    status: string;
    total: number;
    currency: string;
    createdAt: Date;
  }[];
  recentSecurityEvents: {
    id: string;
    eventType: string;
    severity: string;
    ipAddress: string | null;
    createdAt: Date;
  }[];
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  await requireAdmin();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Revenue queries (only paid + fulfilled orders count as revenue)
  const revenueCondition = sql`${orders.status} IN ('paid', 'fulfilled')`;

  const [revenueAll] = await db
    .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
    .from(orders)
    .where(revenueCondition);

  const [revenueToday] = await db
    .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
    .from(orders)
    .where(and(revenueCondition, gte(orders.createdAt, startOfToday)));

  const [revenueWeek] = await db
    .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
    .from(orders)
    .where(and(revenueCondition, gte(orders.createdAt, startOfWeek)));

  const [revenueMonth] = await db
    .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
    .from(orders)
    .where(and(revenueCondition, gte(orders.createdAt, startOfMonth)));

  // Order counts by status
  const orderCounts = await db
    .select({
      status: orders.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(orders)
    .groupBy(orders.status);

  const countMap: Record<string, number> = {};
  let totalOrders = 0;
  for (const row of orderCounts) {
    countMap[row.status] = row.count;
    totalOrders += row.count;
  }

  // Low stock: products with < 5 available inventory items
  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      available: sql<number>`COUNT(${inventoryItems.id})::int`,
    })
    .from(products)
    .leftJoin(
      inventoryItems,
      and(
        eq(inventoryItems.productId, products.id),
        eq(inventoryItems.status, "available"),
      ),
    )
    .where(eq(products.status, "active"))
    .groupBy(products.id, products.name)
    .having(sql`COUNT(${inventoryItems.id}) < 5`)
    .orderBy(sql`COUNT(${inventoryItems.id})`);

  // Recent orders
  const recentOrders = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      customerEmail: orders.customerEmail,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(10);

  // Recent security events
  const recentEvents = await db
    .select({
      id: securityEvents.id,
      eventType: securityEvents.eventType,
      severity: securityEvents.severity,
      ipAddress: securityEvents.ipAddress,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .orderBy(desc(securityEvents.createdAt))
    .limit(5);

  return {
    revenue: {
      today: Number(revenueToday.total),
      week: Number(revenueWeek.total),
      month: Number(revenueMonth.total),
      allTime: Number(revenueAll.total),
      currency: "USD",
    },
    orders: {
      total: totalOrders,
      pending: countMap["pending"] ?? 0,
      paid: countMap["paid"] ?? 0,
      fulfilled: countMap["fulfilled"] ?? 0,
      refunded: countMap["refunded"] ?? 0,
    },
    lowStockProducts: lowStock,
    recentOrders,
    recentSecurityEvents: recentEvents,
  };
}
