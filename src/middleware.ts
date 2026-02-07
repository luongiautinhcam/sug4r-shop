import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function getAllowedOrigin(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function middleware(request: NextRequest) {
  // CSRF Origin check for state-changing methods
  if (STATE_CHANGING_METHODS.has(request.method)) {
    const pathname = request.nextUrl.pathname;

    // Exempt webhook endpoints (external callers)
    if (!pathname.startsWith("/api/webhooks")) {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");

      const requestOrigin = origin
        ? origin
        : referer
          ? new URL(referer).origin
          : null;

      if (requestOrigin && requestOrigin !== getAllowedOrigin()) {
        return new NextResponse(null, { status: 403 });
      }
    }
  }

  const response = NextResponse.next();

  // Add security headers (belt + suspenders with next.config.ts headers)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Optional: Admin IP allowlist
  const adminAllowedIps = process.env.ADMIN_ALLOWED_IPS;
  if (
    adminAllowedIps &&
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/admin/login")
  ) {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const allowedIps = adminAllowedIps.split(",").map((ip) => ip.trim());

    // Simple exact-match check (CIDR can be added later)
    if (!allowedIps.includes(clientIp) && clientIp !== "unknown") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
