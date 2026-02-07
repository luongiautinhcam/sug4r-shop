import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

export const totpSetupSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be numeric"),
});

export const totpVerifySchema = z.object({
  code: z
    .string()
    .min(6, "Code must be at least 6 characters")
    .max(20, "Code too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TotpSetupInput = z.infer<typeof totpSetupSchema>;
export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;
