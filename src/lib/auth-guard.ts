import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lucia } from "./auth";
import type { User, Session } from "lucia";

export type AdminUser = User & {
  email: string;
  role: string;
  isActive: boolean;
};

/**
 * Validates the current admin session from cookies.
 * Returns the user and session if authenticated, null otherwise.
 * Also handles session extension (sliding window).
 */
export async function validateAdminSession(): Promise<{
  user: AdminUser;
  session: Session;
} | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;

  if (!sessionId) return null;

  const result = await lucia.validateSession(sessionId);

  if (!result.session) {
    // Session invalid or expired — clear cookie
    const blankCookie = lucia.createBlankSessionCookie();
    cookieStore.set(
      blankCookie.name,
      blankCookie.value,
      blankCookie.attributes,
    );
    return null;
  }

  // If session is fresh (just extended), update the cookie
  if (result.session.fresh) {
    const sessionCookie = lucia.createSessionCookie(result.session.id);
    cookieStore.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  }

  // Check user is still active
  if (!result.user.isActive) {
    await lucia.invalidateSession(sessionId);
    const blankCookie = lucia.createBlankSessionCookie();
    cookieStore.set(
      blankCookie.name,
      blankCookie.value,
      blankCookie.attributes,
    );
    return null;
  }

  return {
    user: result.user as AdminUser,
    session: result.session,
  };
}

/**
 * Requires an authenticated admin user.
 * Redirects to /admin/login if not authenticated.
 * Use at the top of every admin server component and server action.
 */
export async function requireAdmin(): Promise<{
  user: AdminUser;
  session: Session;
}> {
  const result = await validateAdminSession();
  if (!result) {
    redirect("/admin/login");
  }
  return result;
}

/**
 * Gets client IP from request headers.
 */
export function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}
