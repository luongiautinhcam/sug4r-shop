"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireAdmin, getClientIp } from "@/lib/auth-guard";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/types";

export interface StoreSettings {
  storeName: string;
  storeCurrency: string;
  contactEmail: string;
  paymentManualEnabled: boolean;
  paymentManualInstructions: string;
  deliveryTokenExpiryHours: number;
  deliveryMaxReveals: number;
}

const DEFAULTS: StoreSettings = {
  storeName: "sug4r shop",
  storeCurrency: "USD",
  contactEmail: "",
  paymentManualEnabled: true,
  paymentManualInstructions: "",
  deliveryTokenExpiryHours: 48,
  deliveryMaxReveals: 1,
};

const settingsSchema = z.object({
  storeName: z.string().min(1).max(255),
  storeCurrency: z.string().length(3),
  contactEmail: z.string().email().max(255).or(z.literal("")),
  paymentManualEnabled: z.boolean(),
  paymentManualInstructions: z.string().max(5000),
  deliveryTokenExpiryHours: z.number().int().min(1).max(720),
  deliveryMaxReveals: z.number().int().min(1).max(10),
});

/**
 * Get all settings, returning defaults for missing keys.
 */
export async function getSettings(): Promise<StoreSettings> {
  await requireAdmin();

  const rows = await db.select().from(settings);

  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  return {
    storeName: (map["store_name"] as string) ?? DEFAULTS.storeName,
    storeCurrency: (map["store_currency"] as string) ?? DEFAULTS.storeCurrency,
    contactEmail: (map["contact_email"] as string) ?? DEFAULTS.contactEmail,
    paymentManualEnabled:
      (map["payment_manual_enabled"] as boolean) ?? DEFAULTS.paymentManualEnabled,
    paymentManualInstructions:
      (map["payment_manual_instructions"] as string) ??
      DEFAULTS.paymentManualInstructions,
    deliveryTokenExpiryHours:
      (map["delivery_token_expiry_hours"] as number) ??
      DEFAULTS.deliveryTokenExpiryHours,
    deliveryMaxReveals:
      (map["delivery_max_reveals"] as number) ?? DEFAULTS.deliveryMaxReveals,
  };
}

/**
 * Update settings. Upserts each key individually.
 */
export async function updateSettings(
  data: StoreSettings,
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const entries: [string, unknown][] = [
    ["store_name", parsed.data.storeName],
    ["store_currency", parsed.data.storeCurrency],
    ["contact_email", parsed.data.contactEmail],
    ["payment_manual_enabled", parsed.data.paymentManualEnabled],
    ["payment_manual_instructions", parsed.data.paymentManualInstructions],
    ["delivery_token_expiry_hours", parsed.data.deliveryTokenExpiryHours],
    ["delivery_max_reveals", parsed.data.deliveryMaxReveals],
  ];

  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      const [existing] = await tx
        .select({ key: settings.key })
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (existing) {
        await tx
          .update(settings)
          .set({ value: JSON.stringify(value), updatedAt: new Date() })
          .where(eq(settings.key, key));
      } else {
        await tx.insert(settings).values({
          key,
          value: JSON.stringify(value),
          updatedAt: new Date(),
        });
      }
    }
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "settings.update",
    entityType: "settings",
    entityId: undefined,
    details: parsed.data,
    ipAddress: ip,
  });

  return { success: true };
}
