import { z } from 'zod';

export const addCartItemSchema = z.object({
  product_id: z.string().uuid('ID do produto inválido'),
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
});

export const cartItemParamSchema = z.object({
  itemId: z.string().uuid('ID do item inválido'),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
