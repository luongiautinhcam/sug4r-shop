import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { logger } from "./logger";

interface AuditEventParams {
  adminUserId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs an admin action to the audit_logs table.
 * Details are stored but sensitive fields should be pre-redacted by the caller.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      adminUserId: params.adminUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details ?? {},
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    logger.info("Audit event logged", {
      action: params.action,
      entityType: params.entityType ?? "",
      entityId: params.entityId ?? "",
    });
  } catch (error) {
    // Audit logging should never crash the application, but we log the failure
    logger.error("Failed to log audit event", {
      action: params.action,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
