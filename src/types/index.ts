// Shared type definitions

export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "refunded"
  | "cancelled";

export type ProductStatus = "draft" | "active" | "archived";

export type InventoryStatus = "available" | "reserved" | "sold" | "revoked";

export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded";

export type PaymentMethod = "manual_transfer" | "stripe";

export type SecuritySeverity = "info" | "warn" | "critical";

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
