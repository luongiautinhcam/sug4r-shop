import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens",
    ),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().max(10000).optional(),
  shortDesc: z.string().max(500).optional(),
  imageUrl: z.string().url().max(2048).optional().or(z.literal("")),
  price: z.number().int().min(1, "Price must be at least 1 cent"),
  currency: z.string().length(3).default("USD"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  sortOrder: z.number().int().default(0),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens",
    ),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
