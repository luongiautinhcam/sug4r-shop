import { NextRequest, NextResponse } from "next/server";
import { checkDeliveryToken, revealDelivery } from "@/lib/delivery";
import { RATE_LIMITS } from "@/lib/rate-limit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * GET /api/delivery/[token] — Check delivery token status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = getClientIp(request);

  const rl = RATE_LIMITS.delivery(`api:delivery:check:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    );
  }

  const result = await checkDeliveryToken(token);
  return NextResponse.json(result);
}

/**
 * POST /api/delivery/[token] — Reveal delivery credential (one-time)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = getClientIp(request);

  const rl = RATE_LIMITS.delivery(`api:delivery:reveal:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    );
  }

  const result = await revealDelivery(token, ip);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ credential: result.credential });
}
