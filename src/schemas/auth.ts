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

export const totpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be numeric"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
