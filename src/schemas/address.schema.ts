import { z } from 'zod';

export const createAddressSchema = z.object({
  name: z.string().min(2, 'Nome do destinatário obrigatório'),
  phone: z.string().min(8, 'Telefone de contato obrigatório'),
  cep: z.string().min(8, 'CEP inválido'),
  street: z.string().min(2, 'Rua/Avenida obrigatória'),
  number: z.string().min(1, 'Número obrigatório'),
  complement: z.string().nullable().optional(),
  neighborhood: z.string().min(2, 'Bairro obrigatório'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().min(2, 'Estado obrigatório (UF)'),
  reference: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export const addressIdParamSchema = z.object({
  id: z.string().uuid('ID de endereço inválido'),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
