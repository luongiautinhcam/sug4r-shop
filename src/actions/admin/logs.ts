"use server";

import { db } from "@/db";
import { auditLogs, adminUsers, securityEvents } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { eq, and, desc, sql } from "drizzle-orm";

export interface AuditLogEntry {
  id: string;
  adminEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

export interface SecurityEventEntry {
  id: string;
  eventType: string;
  severity: string;
  ipAddress: string | null;
  targetEmail: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Get paginated audit logs with admin user email.
 */
export async function getAuditLogs(opts?: {
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  await requireAdmin();

  const { action, entityType, limit = 30, offset = 0 } = opts ?? {};

  const conditions = [];
  if (action) conditions.push(eq(auditLogs.action, action));
  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(auditLogs)
    .where(where);

  const rows = await db
    .select({
      id: auditLogs.id,
      adminEmail: adminUsers.email,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(adminUsers, eq(auditLogs.adminUserId, adminUsers.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    logs: rows.map((r) => ({
      ...r,
      details: (r.details ?? {}) as Record<string, unknown>,
    })),
    total: Number(total),
  };
}

/**
 * Get distinct audit action types for filter dropdown.
 */
export async function getAuditActions(): Promise<string[]> {
  await requireAdmin();

  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(auditLogs.action);

  return rows.map((r) => r.action);
}

/**
 * Get paginated security events.
 */
export async function getSecurityEvents(opts?: {
  eventType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: SecurityEventEntry[]; total: number }> {
  await requireAdmin();

  const { eventType, severity, limit = 30, offset = 0 } = opts ?? {};

  const conditions = [];
  if (eventType) conditions.push(eq(securityEvents.eventType, eventType));
  if (severity) conditions.push(eq(securityEvents.severity, severity));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(securityEvents)
    .where(where);

  const rows = await db
    .select({
      id: securityEvents.id,
      eventType: securityEvents.eventType,
      severity: securityEvents.severity,
      ipAddress: securityEvents.ipAddress,
      targetEmail: securityEvents.targetEmail,
      details: securityEvents.details,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .where(where)
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    events: rows.map((r) => ({
      ...r,
      details: (r.details ?? {}) as Record<string, unknown>,
    })),
    total: Number(total),
  };
}

/**
 * Get distinct security event types for filter dropdown.
 */
export async function getSecurityEventTypes(): Promise<string[]> {
  await requireAdmin();

  const rows = await db
    .selectDistinct({ eventType: securityEvents.eventType })
    .from(securityEvents)
    .orderBy(securityEvents.eventType);

  return rows.map((r) => r.eventType);
}
