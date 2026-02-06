import { LOG_LEVEL } from "./constants";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = LEVEL_PRIORITY[LOG_LEVEL as LogLevel] ?? LEVEL_PRIORITY.info;

/**
 * Redacts sensitive fields from log data.
 * Ensures no passwords, tokens, keys, or credentials leak into logs.
 */
function redact(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = [
    "password",
    "password_hash",
    "passwordHash",
    "token",
    "secret",
    "credential",
    "encryptionKey",
    "encryption_key",
    "sessionId",
    "session_id",
    "totp_secret",
    "totpSecret",
    "encrypted_payload",
    "encryptedPayload",
    "authorization",
  ];

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    } else if (lowerKey === "email" && typeof value === "string") {
      // Partially redact emails
      const [local, domain] = value.split("@");
      if (local && domain) {
        redacted[key] = `${local.slice(0, 2)}***@${domain}`;
      } else {
        redacted[key] = "[REDACTED_EMAIL]";
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      redacted[key] = redact(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < minLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data ? { data: redact(data) } : {}),
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) =>
    log("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) =>
    log("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    log("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    log("error", message, data),
};
