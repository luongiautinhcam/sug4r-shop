import { z } from "zod";

export const importInventorySchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  credentials: z
    .array(
      z
        .string()
        .min(1, "Credential cannot be empty")
        .max(5000, "Credential too long"),
    )
    .min(1, "At least one credential is required")
    .max(500, "Maximum 500 credentials per import"),
});

export type ImportInventoryInput = z.infer<typeof importInventorySchema>;
