import { z } from 'zod';

const paymentMethodSchema = z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'other']);

const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
]);

const baseCreateOrderSchema = z.object({
  fulfillment_type: z.enum(['delivery', 'pickup']).default('delivery'),
  payment_method: paymentMethodSchema.default('cash'),
  notes: z.string().max(500, 'Observação muito longa').nullable().optional(),
  address_id: z.string().uuid('ID de endereço inválido').optional(),
  agency_id: z.string().uuid('ID da agência inválido').optional(),
  pickup_contact_name: z.string().min(2).max(255).optional(),
  pickup_contact_phone: z.string().min(8).max(50).optional(),
  pickup_scheduled_at: z.string().max(40).nullable().optional(),
});

export const createOrderSchema = baseCreateOrderSchema.superRefine((data, ctx) => {
  if (data.fulfillment_type === 'delivery') {
    if (!data.address_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'address_id é obrigatório para entrega',
        path: ['address_id'],
      });
    }
    return;
  }

  if (!data.agency_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'agency_id é obrigatório para retirada na agência',
      path: ['agency_id'],
    });
  }
  if (!data.pickup_contact_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Nome de quem retira é obrigatório',
      path: ['pickup_contact_name'],
    });
  }
  if (!data.pickup_contact_phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Telefone de quem retira é obrigatório',
      path: ['pickup_contact_phone'],
    });
  }
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid('ID do pedido inválido'),
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: orderStatusSchema.optional(),
  fulfillment_type: z.enum(['delivery', 'pickup']).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
