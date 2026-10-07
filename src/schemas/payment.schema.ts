import { z } from 'zod';

export const createPaymentSchema = z.object({
  order_id: z.string().uuid('ID do pedido inválido'),
  method: z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'other']),
});

export const paymentIdParamSchema = z.object({
  id: z.string().uuid('ID do pagamento inválido'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
