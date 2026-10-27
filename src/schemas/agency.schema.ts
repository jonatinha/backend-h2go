import { z } from 'zod';

const openingHoursSchema = z.record(z.string(), z.unknown()).default({});

export const agencyIdParamSchema = z.object({
  id: z.string().uuid('ID da agência inválido'),
});

export const agencySlugParamSchema = z.object({
  slug: z.string().min(2, 'Slug inválido'),
});

export const listAgenciesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  city: z.string().min(2).optional(),
  state: z.string().min(2).max(10).optional(),
  active_only: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
});

export const createAgencySchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(255).optional(),
  phone: z.string().min(8).max(50).nullable().optional(),
  email: z.union([z.string().email(), z.literal('')]).nullable().optional(),
  cep: z.string().min(8).max(20),
  street: z.string().min(2).max(255),
  number: z.string().min(1).max(50),
  complement: z.string().max(255).nullable().optional(),
  neighborhood: z.string().min(2).max(255),
  city: z.string().min(2).max(255),
  state: z.string().min(2).max(10),
  reference: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  pickup_instructions: z.string().max(1000).nullable().optional(),
  opening_hours: openingHoursSchema.optional(),
  accepts_pickup: z.boolean().default(true),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

export const updateAgencySchema = createAgencySchema.partial();

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;
export type ListAgenciesQuery = z.infer<typeof listAgenciesQuerySchema>;
