import { db } from "@/db";
import { securityEvents } from "@/db/schema";
import { logger } from "./logger";
import type { SecuritySeverity } from "@/types";

interface SecurityEventParams {
  eventType: string;
  severity?: SecuritySeverity;
  ipAddress?: string;
  userAgent?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
}

/**
 * Logs a security event to the security_events table.
 * Used for tracking failed logins, rate limit hits, webhook anomalies, etc.
 */
export async function logSecurityEvent(
  params: SecurityEventParams,
): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      eventType: params.eventType,
      severity: params.severity ?? "info",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      targetEmail: params.targetEmail,
      details: params.details ?? {},
    });

    logger.info("Security event logged", {
      eventType: params.eventType,
      severity: params.severity ?? "info",
    });
  } catch (error) {
    logger.error("Failed to log security event", {
      eventType: params.eventType,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
