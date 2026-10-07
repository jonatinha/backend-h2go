import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category_id: z.string().uuid().optional(),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const getProductParamsSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const getProductBySlugSchema = z.object({
  slug: z.string().min(1, 'Slug obrigatório'),
});

export const createProductSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string().min(2, 'Slug deve ter pelo menos 2 caracteres'),
  sku: z.string().min(2, 'SKU deve ter pelo menos 2 caracteres'),
  description: z.string().nullable().optional(),
  price: z.coerce.number().positive('Preço deve ser positivo'),
  unit: z.string().default('unidade'),
  minimum_quantity: z.coerce.number().int().min(1).default(1),
  maximum_quantity: z.coerce.number().int().positive().nullable().optional(),
  quantity_step: z.coerce.number().int().min(1).default(1),
  package_size: z.coerce.number().int().positive().nullable().optional(),
  package_label: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  stock_control_enabled: z.boolean().default(false),
  stock_quantity: z.coerce.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const updateProductPriceSchema = z.object({
  price: z.coerce.number().positive('Preço deve ser positivo'),
});

export const updateProductStatusSchema = z.object({
  is_active: z.boolean(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductPriceInput = z.infer<typeof updateProductPriceSchema>;
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;
