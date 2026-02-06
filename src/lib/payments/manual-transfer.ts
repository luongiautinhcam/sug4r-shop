import { db } from "@/db";
import { payments } from "@/db/schema";
import type {
  PaymentAdapter,
  PaymentIntentResult,
  PaymentInstructions,
} from "./types";

/**
 * Manual bank transfer payment adapter.
 * Creates a pending payment record; admin manually marks as paid after verification.
 */
export const manualTransferAdapter: PaymentAdapter = {
  name: "manual_transfer",

  async createPaymentIntent(order): Promise<PaymentIntentResult> {
    const [payment] = await db
      .insert(payments)
      .values({
        orderId: order.id,
        paymentMethod: "manual_transfer",
        status: "pending",
        amount: order.total,
        currency: order.currency,
        idempotencyKey: `manual_${order.id}`,
      })
      .returning({ id: payments.id });

    return {
      paymentId: payment!.id,
      instructions: `Please transfer the total amount to our bank account. Use order code ${order.orderCode} as the payment reference. Your order will be processed after payment verification.`,
    };
  },

  getPaymentInstructions(orderCode: string): PaymentInstructions | null {
    // In production, these would come from settings/DB
    return {
      text: `Transfer the exact amount using order code ${orderCode} as the reference.`,
      details: {
        "Bank Name": "Configure in admin settings",
        "Account Number": "Configure in admin settings",
        Reference: orderCode,
      },
    };
  },
};
