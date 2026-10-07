import { z } from 'zod';

export const createOrderSchema = z.object({
  address_id: z.string().uuid('ID de endereço inválido'),
  payment_method: z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'other']).default('cash'),
  notes: z.string().max(500, 'Observação muito longa').nullable().optional(),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid('ID do pedido inválido'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ]),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ]).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
