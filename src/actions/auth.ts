"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verify } from "argon2";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { lucia } from "@/lib/auth";
import { validateAdminSession, getClientIp } from "@/lib/auth-guard";
import { loginSchema } from "@/schemas/auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security-events";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types";

export async function loginAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const userAgent = headersList.get("user-agent") ?? "unknown";

  // 1. Validate input
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: "Invalid email or password." };
  }

  const { email, password } = parsed.data;

  // 2. Rate limit by IP
  const ipLimit = RATE_LIMITS.adminLogin(`login:ip:${ip}`);
  if (!ipLimit.allowed) {
    await logSecurityEvent({
      eventType: "login.rate_limited",
      severity: "warn",
      ipAddress: ip,
      userAgent,
      targetEmail: email,
      details: { reason: "ip_rate_limit" },
    });
    return {
      success: false,
      error: "Too many login attempts. Please try again later.",
    };
  }

  // 3. Rate limit by email
  const emailLimit = RATE_LIMITS.adminLogin(`login:email:${email}`);
  if (!emailLimit.allowed) {
    await logSecurityEvent({
      eventType: "login.rate_limited",
      severity: "warn",
      ipAddress: ip,
      userAgent,
      targetEmail: email,
      details: { reason: "email_rate_limit" },
    });
    return {
      success: false,
      error: "Too many login attempts. Please try again later.",
    };
  }

  // 4. Look up user
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    await logSecurityEvent({
      eventType: "login.failed",
      severity: "warn",
      ipAddress: ip,
      userAgent,
      targetEmail: email,
      details: { reason: "user_not_found" },
    });
    return { success: false, error: "Invalid credentials." };
  }

  // 5. Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logSecurityEvent({
      eventType: "login.locked",
      severity: "warn",
      ipAddress: ip,
      userAgent,
      targetEmail: email,
      details: { lockedUntil: user.lockedUntil.toISOString() },
    });
    return { success: false, error: "Invalid credentials." };
  }

  // 6. Check if user is active
  if (!user.isActive) {
    return { success: false, error: "Invalid credentials." };
  }

  // 7. Verify password
  let passwordValid: boolean;
  try {
    passwordValid = await verify(user.passwordHash, password);
  } catch {
    logger.error("Password verification error", { email });
    return { success: false, error: "Invalid credentials." };
  }

  if (!passwordValid) {
    // Increment failed attempts
    const newAttempts = user.failedAttempts + 1;
    const lockout = newAttempts >= 10;

    await db
      .update(adminUsers)
      .set({
        failedAttempts: newAttempts,
        ...(lockout
          ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) } // 30 min lockout
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, user.id));

    await logSecurityEvent({
      eventType: "login.failed",
      severity: lockout ? "critical" : "warn",
      ipAddress: ip,
      userAgent,
      targetEmail: email,
      details: {
        reason: "invalid_password",
        failedAttempts: newAttempts,
        locked: lockout,
      },
    });

    return { success: false, error: "Invalid credentials." };
  }

  // 8. Success — create session
  const session = await lucia.createSession(user.id, {
    // Lucia stores these in the session table via the adapter
  });

  // Store IP and user agent in the session record directly
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
  const cookieStore = await cookies();
  cookieStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  // Log success
  await logSecurityEvent({
    eventType: "login.success",
    severity: "info",
    ipAddress: ip,
    userAgent,
    targetEmail: email,
  });

  await logAuditEvent({
    adminUserId: user.id,
    action: "auth.login",
    ipAddress: ip,
    userAgent,
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const result = await validateAdminSession();
  if (!result) {
    redirect("/admin/login");
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);
  const userAgent = headersList.get("user-agent") ?? "unknown";

  await lucia.invalidateSession(result.session.id);

  const blankCookie = lucia.createBlankSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(
    blankCookie.name,
    blankCookie.value,
    blankCookie.attributes,
  );

  await logAuditEvent({
    adminUserId: result.user.id,
    action: "auth.logout",
    ipAddress: ip,
    userAgent,
  });

  redirect("/admin/login");
}
