import { z } from "zod";

export const checkoutSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(255),
  emailConfirm: z
    .string()
    .email("Invalid email address")
    .max(255),
  productId: z.string().uuid("Invalid product"),
  quantity: z.number().int().min(1).max(10, "Maximum 10 per order"),
  paymentMethod: z.enum(["manual_transfer", "stripe"]).default("manual_transfer"),
}).refine((data) => data.email === data.emailConfirm, {
  message: "Emails must match",
  path: ["emailConfirm"],
});

export const orderLookupSchema = z.object({
  orderCode: z
    .string()
    .min(1, "Order code is required")
    .max(20)
    .transform((v) => v.toUpperCase().trim()),
  email: z
    .string()
    .email("Invalid email address")
    .max(255),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderLookupInput = z.infer<typeof orderLookupSchema>;
