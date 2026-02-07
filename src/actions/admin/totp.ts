"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminUsers, settings } from "@/db/schema";
import { requireAdmin, getClientIp } from "@/lib/auth-guard";
import { lucia } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyPendingTotpToken,
} from "@/lib/totp";
import { totpSetupSchema, totpVerifySchema } from "@/schemas/auth";
import { logAuditEvent } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security-events";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types";

/**
 * Begin TOTP setup: generate secret and QR code.
 * Stores temp secret in settings table for confirmation.
 */
export async function beginTotpSetup(): Promise<
  ActionResult<{ secret: string; qrDataUrl: string }>
> {
  const { user } = await requireAdmin();

  const result = await generateTotpSecret(user.email);

  // Store temp secret in settings table
  const tempKey = `totp_setup_${user.id}`;
  const [existing] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, tempKey))
    .limit(1);

  if (existing) {
    await db
      .update(settings)
      .set({ value: JSON.stringify(result.secret), updatedAt: new Date() })
      .where(eq(settings.key, tempKey));
  } else {
    await db.insert(settings).values({
      key: tempKey,
      value: JSON.stringify(result.secret),
      updatedAt: new Date(),
    });
  }

  return {
    success: true,
    data: { secret: result.secret, qrDataUrl: result.qrDataUrl },
  };
}

/**
 * Confirm TOTP setup with a verification code.
 * Encrypts and stores secret, generates recovery codes.
 */
export async function confirmTotpSetup(
  code: string,
): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = totpSetupSchema.safeParse({ code });
  if (!parsed.success) {
    return { success: false, error: "Invalid code format." };
  }

  // Read temp secret
  const tempKey = `totp_setup_${user.id}`;
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, tempKey))
    .limit(1);

  if (!row) {
    return { success: false, error: "No pending TOTP setup found." };
  }

  const secret = JSON.parse(row.value as string) as string;

  // Verify code
  if (!verifyTotpCode(secret, parsed.data.code)) {
    return { success: false, error: "Invalid verification code." };
  }

  // Encrypt secret and store
  const encrypted = encrypt(secret);
  const encryptedSecretStr = JSON.stringify({
    encrypted: encrypted.encrypted.toString("base64"),
    iv: encrypted.iv.toString("base64"),
    tag: encrypted.tag.toString("base64"),
    keyId: encrypted.keyId,
  });

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes(8);
  const encryptedCodes = encrypt(JSON.stringify(recoveryCodes));
  const encryptedCodesStr = JSON.stringify({
    encrypted: encryptedCodes.encrypted.toString("base64"),
    iv: encryptedCodes.iv.toString("base64"),
    tag: encryptedCodes.tag.toString("base64"),
    keyId: encryptedCodes.keyId,
  });

  await db.transaction(async (tx) => {
    // Update user
    await tx
      .update(adminUsers)
      .set({
        totpSecret: encryptedSecretStr,
        totpEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, user.id));

    // Store encrypted recovery codes
    const recoveryKey = `totp_recovery_${user.id}`;
    const [existingRecovery] = await tx
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, recoveryKey))
      .limit(1);

    if (existingRecovery) {
      await tx
        .update(settings)
        .set({ value: encryptedCodesStr, updatedAt: new Date() })
        .where(eq(settings.key, recoveryKey));
    } else {
      await tx.insert(settings).values({
        key: recoveryKey,
        value: encryptedCodesStr,
        updatedAt: new Date(),
      });
    }

    // Delete temp secret
    await tx.delete(settings).where(eq(settings.key, tempKey));
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "totp.enabled",
    ipAddress: ip,
  });

  return { success: true, data: { recoveryCodes } };
}

/**
 * Disable TOTP 2FA. Requires current TOTP code for verification.
 */
export async function disableTotp(code: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const parsed = totpSetupSchema.safeParse({ code });
  if (!parsed.success) {
    return { success: false, error: "Invalid code format." };
  }

  // Load user with TOTP secret
  const [dbUser] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, user.id))
    .limit(1);

  if (!dbUser?.totpEnabled || !dbUser.totpSecret) {
    return { success: false, error: "TOTP is not enabled." };
  }

  // Decrypt and verify
  const secretData = JSON.parse(dbUser.totpSecret);
  const decryptedSecret = decrypt({
    encrypted: Buffer.from(secretData.encrypted, "base64"),
    iv: Buffer.from(secretData.iv, "base64"),
    tag: Buffer.from(secretData.tag, "base64"),
    keyId: secretData.keyId,
  });

  if (!verifyTotpCode(decryptedSecret, parsed.data.code)) {
    return { success: false, error: "Invalid verification code." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({
        totpSecret: null,
        totpEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, user.id));

    // Delete recovery codes
    await tx
      .delete(settings)
      .where(eq(settings.key, `totp_recovery_${user.id}`));
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "totp.disabled",
    ipAddress: ip,
  });

  return { success: true };
}

/**
 * Verify TOTP code during login (called after password step).
 * Reads the pending token from cookie, verifies, creates session.
 */
export async function verifyTotpLogin(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const userAgent = headersList.get("user-agent") ?? "unknown";

  const rawCode = formData.get("code");
  const parsed = totpVerifySchema.safeParse({ code: rawCode });
  if (!parsed.success) {
    return { success: false, error: "Invalid code." };
  }

  // Read pending token from cookie
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get("totp_pending")?.value;
  if (!pendingToken) {
    return { success: false, error: "Session expired. Please log in again." };
  }

  // Verify HMAC token
  const userId = verifyPendingTotpToken(pendingToken);
  if (!userId) {
    cookieStore.delete("totp_pending");
    return { success: false, error: "Session expired. Please log in again." };
  }

  // Load user
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1);

  if (!user || !user.totpEnabled || !user.totpSecret) {
    cookieStore.delete("totp_pending");
    return { success: false, error: "Invalid state." };
  }

  // Decrypt TOTP secret
  const secretData = JSON.parse(user.totpSecret);
  const decryptedSecret = decrypt({
    encrypted: Buffer.from(secretData.encrypted, "base64"),
    iv: Buffer.from(secretData.iv, "base64"),
    tag: Buffer.from(secretData.tag, "base64"),
    keyId: secretData.keyId,
  });

  const code = parsed.data.code;
  let verified = false;

  // Try TOTP code first (6-digit numeric)
  if (/^\d{6}$/.test(code)) {
    verified = verifyTotpCode(decryptedSecret, code);
  }

  // If not verified, try recovery code
  if (!verified) {
    const recoveryKey = `totp_recovery_${userId}`;
    const [recoveryRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, recoveryKey))
      .limit(1);

    if (recoveryRow) {
      try {
        const encData = JSON.parse(recoveryRow.value as string);
        const decryptedCodes = decrypt({
          encrypted: Buffer.from(encData.encrypted, "base64"),
          iv: Buffer.from(encData.iv, "base64"),
          tag: Buffer.from(encData.tag, "base64"),
          keyId: encData.keyId,
        });

        const codes: string[] = JSON.parse(decryptedCodes);
        const idx = codes.indexOf(code.toLowerCase());
        if (idx !== -1) {
          verified = true;
          // Remove used recovery code
          codes.splice(idx, 1);
          const reEncrypted = encrypt(JSON.stringify(codes));
          const reEncryptedStr = JSON.stringify({
            encrypted: reEncrypted.encrypted.toString("base64"),
            iv: reEncrypted.iv.toString("base64"),
            tag: reEncrypted.tag.toString("base64"),
            keyId: reEncrypted.keyId,
          });

          await db
            .update(settings)
            .set({ value: reEncryptedStr, updatedAt: new Date() })
            .where(eq(settings.key, recoveryKey));

          logger.info("Recovery code used", { userId });
        }
      } catch {
        logger.error("Failed to process recovery codes", { userId });
      }
    }
  }

  if (!verified) {
    await logSecurityEvent({
      eventType: "totp.failed",
      severity: "warn",
      ipAddress: ip,
      userAgent,
      details: { userId },
    });
    return { success: false, error: "Invalid verification code." };
  }

  // Create session
  const session = await lucia.createSession(user.id, {});

  await db
    .update(adminUsers)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adminUsers.id, user.id));

  // Set session cookie
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookieStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  // Clear pending cookie
  cookieStore.delete("totp_pending");

  await logSecurityEvent({
    eventType: "login.success",
    severity: "info",
    ipAddress: ip,
    userAgent,
    targetEmail: user.email,
    details: { method: "totp" },
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "auth.login",
    ipAddress: ip,
    userAgent,
  });

  redirect("/admin");
}
