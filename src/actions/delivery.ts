"use server";

import { checkDeliveryToken, revealDelivery } from "@/lib/delivery";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";
import type { DeliveryCheckResult, RevealResult } from "@/lib/delivery";

function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Public action: check if a delivery token is valid without revealing.
 */
export async function checkDeliveryAction(
  token: string,
): Promise<ActionResult<DeliveryCheckResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const rl = RATE_LIMITS.delivery(`delivery:check:${ip}`);
  if (!rl.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const result = await checkDeliveryToken(token);
  return { success: true, data: result };
}

/**
 * Public action: reveal a delivery credential (view-once).
 */
export async function revealDeliveryAction(
  token: string,
): Promise<ActionResult<RevealResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const rl = RATE_LIMITS.delivery(`delivery:reveal:${ip}`);
  if (!rl.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const result = await revealDelivery(token, ip);
  return { success: true, data: result };
}
