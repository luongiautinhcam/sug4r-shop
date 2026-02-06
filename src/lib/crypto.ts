import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM (NIST recommended)
const TAG_LENGTH = 16; // 128-bit authentication tag

export interface EncryptedPayload {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyId: string;
}

/**
 * Retrieves the encryption key for the given key ID from environment variables.
 * Keys are stored as 64-character hex strings (32 bytes).
 */
function getKeyById(keyId: string): Buffer {
  const envKey = `ENCRYPTION_KEY_${keyId.toUpperCase()}`;
  const hex = process.env[envKey];
  if (!hex) {
    throw new Error(`Encryption key not found for key ID: ${keyId}`);
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `Encryption key ${envKey} must be exactly 32 bytes (64 hex chars), got ${key.length}`,
    );
  }
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns the encrypted payload with IV and auth tag for storage.
 */
export function encrypt(
  plaintext: string,
  keyId: string = "v1",
): EncryptedPayload {
  const key = getKeyById(keyId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return { encrypted, iv, tag, keyId };
}

/**
 * Decrypts an encrypted payload back to the original plaintext string.
 * Verifies the authentication tag to detect tampering.
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getKeyById(payload.keyId);
  const decipher = createDecipheriv(ALGORITHM, key, payload.iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(payload.tag);
  const decrypted = Buffer.concat([
    decipher.update(payload.encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
