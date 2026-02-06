import type { PaymentAdapter } from "./types";
import { manualTransferAdapter } from "./manual-transfer";

const adapters: Record<string, PaymentAdapter> = {
  manual_transfer: manualTransferAdapter,
  // stripe: stripeAdapter, // TODO: implement in Phase 5+
};

/**
 * Returns the payment adapter for the given method name.
 * Throws if the method is not registered.
 */
export function getPaymentAdapter(method: string): PaymentAdapter {
  const adapter = adapters[method];
  if (!adapter) {
    throw new Error(`Unknown payment method: ${method}`);
  }
  return adapter;
}

/**
 * Returns all available payment method names.
 */
export function getAvailablePaymentMethods(): string[] {
  return Object.keys(adapters);
}
