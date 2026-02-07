import { createHmac, randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const TOTP_ISSUER = "SugarShop";
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const PENDING_TOKEN_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required for TOTP");
  }
  return secret;
}

/**
 * Generate a new TOTP secret, URI, and QR code data URL for the given email.
 */
export async function generateTotpSecret(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 });

  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret,
  });

  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri);

  return {
    secret: secret.base32,
    uri,
    qrDataUrl,
  };
}

/**
 * Verify a 6-digit TOTP code against a base32 secret.
 */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });

  const delta = totp.validate({ token: code, window: TOTP_WINDOW });
  return delta !== null;
}

/**
 * Generate an array of random recovery codes (8-char alphanumeric).
 */
export function generateRecoveryCodes(count: number = 8): string[] {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code);
  }
  return codes;
}

/**
 * Create an HMAC-signed pending TOTP token for the given user ID.
 * Format: `${userId}.${timestampMs}.${hmac}`
 */
export function createPendingTotpToken(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}.${timestamp}`;
  const hmac = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Verify a pending TOTP token. Returns the userId if valid, null otherwise.
 */
export function verifyPendingTotpToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, timestampStr, providedHmac] = parts;

  // Verify HMAC
  const payload = `${userId}.${timestampStr}`;
  const expectedHmac = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");

  if (providedHmac !== expectedHmac) return null;

  // Check expiry
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return null;
  if (Date.now() - timestamp > PENDING_TOKEN_MAX_AGE_MS) return null;

  return userId;
}
