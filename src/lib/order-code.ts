import { randomBytes } from "node:crypto";
import { ORDER_CODE_PREFIX } from "./constants";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0, O, 1, I to avoid confusion

/**
 * Generates a human-readable, crypto-safe order code.
 * Format: ORD-XXXXXX (e.g., ORD-A2B3C4)
 */
export function generateOrderCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${ORDER_CODE_PREFIX}-${code}`;
}
