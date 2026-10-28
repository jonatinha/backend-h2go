import { z } from 'zod';

export const deliveryAssignmentStatusSchema = z.enum([
  'accepted',
  'en_route_pickup',
  'picked_up',
  'en_route_delivery',
  'completed',
  'cancelled',
]);

export const createDriverSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  vehicle_type: z.string().optional(),
  vehicle_brand: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_color: z.string().optional(),
  vehicle_plate: z.string().optional(),
  max_distance_km: z.number().positive().nullable().optional(),
  max_units: z.number().int().positive().nullable().optional(),
  allowed_category_ids: z.array(z.string().uuid()).optional(),
  region_ids: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional(),
});

export const updateDriverSchema = createDriverSchema
  .omit({ email: true, password: true })
  .partial()
  .extend({
    is_active: z.boolean().optional(),
    region_ids: z.array(z.string().uuid()).optional(),
  });

export const resetDriverPasswordSchema = z.object({
  password: z.string().min(6),
});

export const createRegionSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2),
  description: z.string().optional(),
  boundary_type: z.enum(['polygon', 'radius', 'manual']),
  geometry: z.record(z.unknown()).optional(),
  center_lat: z.number().nullable().optional(),
  center_lng: z.number().nullable().optional(),
  radius_km: z.number().positive().nullable().optional(),
  neighborhoods: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export const updateRegionSchema = createRegionSchema.partial();

export const updateRunStatusSchema = z.object({
  status: deliveryAssignmentStatusSchema,
});

export const listDriversQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  region_id: z.string().uuid().optional(),
});
