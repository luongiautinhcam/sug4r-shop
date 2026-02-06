export const SITE_NAME =
  process.env.NEXT_PUBLIC_SITE_NAME ?? "Sugar Shop";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY ?? "USD";

export const SESSION_MAX_AGE_HOURS = Number(
  process.env.SESSION_MAX_AGE_HOURS ?? "24",
);

export const DELIVERY_TOKEN_EXPIRY_HOURS = Number(
  process.env.DELIVERY_TOKEN_EXPIRY_HOURS ?? "48",
);

export const DELIVERY_MAX_REVEALS = Number(
  process.env.DELIVERY_MAX_REVEALS ?? "1",
);

export const RATE_LIMIT_ENABLED =
  process.env.RATE_LIMIT_ENABLED !== "false";

export const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

export const SESSION_COOKIE_NAME = "admin_session";

export const ORDER_CODE_PREFIX = "ORD";

export const ADMIN_ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS
  ? process.env.ADMIN_ALLOWED_IPS.split(",").map((ip) => ip.trim())
  : [];
