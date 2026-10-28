import { supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  deliveryDriverRepository,
  deliveryRegionRepository,
} from '../repositories/deliveryRepository.js';
import type { DeliveryDriver, UserProfile } from '../types/index.js';
import type { z } from 'zod';
import type { createDriverSchema, updateDriverSchema } from '../schemas/delivery.schema.js';

type CreateDriverInput = z.infer<typeof createDriverSchema>;
type UpdateDriverInput = z.infer<typeof updateDriverSchema>;

export class DeliveryDriverAdminService {
  async createDriver(input: CreateDriverInput): Promise<DeliveryDriver> {
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('EMAIL_EXISTS: Já existe um usuário com este e-mail.');
    }

    if (!isSupabaseConfigured() && process.env.NODE_ENV !== 'test') {
      throw new Error('AUTH_UNAVAILABLE: Supabase necessário para criar entregador.');
    }

    let profileId: string;

    if (process.env.NODE_ENV === 'test') {
      profileId = crypto.randomUUID();
      await userRepository.createProfile({
        id: profileId,
        email,
        full_name: input.full_name,
        phone: input.phone ?? null,
        role: 'delivery',
        is_active: input.is_active ?? true,
      });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.full_name,
          phone: input.phone,
          role: 'delivery',
        },
      });

      if (error || !data.user) {
        throw new Error(`AUTH_ERROR: ${error?.message ?? 'Falha ao criar login.'}`);
      }

      profileId = data.user.id;
      await userRepository.createProfile({
        id: profileId,
        email,
        full_name: input.full_name,
        phone: input.phone ?? null,
        role: 'delivery',
        is_active: input.is_active ?? true,
      });
    }

    const driver = await deliveryDriverRepository.create({
      profile_id: profileId,
      vehicle_type: input.vehicle_type ?? null,
      vehicle_brand: input.vehicle_brand ?? null,
      vehicle_model: input.vehicle_model ?? null,
      vehicle_color: input.vehicle_color ?? null,
      vehicle_plate: input.vehicle_plate ?? null,
      avatar_url: null,
      max_distance_km: input.max_distance_km ?? null,
      max_units: input.max_units ?? null,
      allowed_category_ids: input.allowed_category_ids ?? [],
      rules_override: {},
      is_active: input.is_active ?? true,
    });

    if (input.region_ids?.length) {
      await deliveryDriverRepository.setRegions(driver.id, input.region_ids);
      driver.region_ids = input.region_ids;
    }

    const profile = await userRepository.findById(profileId);
    return { ...driver, profile: profile ?? undefined };
  }

  async updateDriver(id: string, input: UpdateDriverInput): Promise<DeliveryDriver | null> {
    const driver = await deliveryDriverRepository.findById(id);
    if (!driver) return null;

    if (input.full_name || input.phone) {
      await userRepository.updateProfile(driver.profile_id, {
        full_name: input.full_name,
        phone: input.phone,
        is_active: input.is_active,
      });
    } else if (input.is_active !== undefined) {
      await userRepository.updateProfile(driver.profile_id, { is_active: input.is_active });
    }

    const updated = await deliveryDriverRepository.update(id, {
      vehicle_type: input.vehicle_type,
      vehicle_brand: input.vehicle_brand,
      vehicle_model: input.vehicle_model,
      vehicle_color: input.vehicle_color,
      vehicle_plate: input.vehicle_plate,
      max_distance_km: input.max_distance_km,
      max_units: input.max_units,
      allowed_category_ids: input.allowed_category_ids,
      is_active: input.is_active,
    });

    if (input.region_ids) {
      await deliveryDriverRepository.setRegions(id, input.region_ids);
      if (updated) updated.region_ids = input.region_ids;
    }

    if (updated) {
      updated.profile = (await userRepository.findById(driver.profile_id)) ?? undefined;
    }
    return updated;
  }

  async resetPassword(profileId: string, password: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    if (!isSupabaseConfigured()) {
      throw new Error('AUTH_UNAVAILABLE');
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profileId, { password });
    if (error) throw new Error(`AUTH_ERROR: ${error.message}`);
  }

  async getDriverProfile(id: string): Promise<(DeliveryDriver & { profile: UserProfile | undefined }) | null> {
    const driver = await deliveryDriverRepository.findById(id);
    if (!driver) return null;
    const profile = await userRepository.findById(driver.profile_id);
    const regions =
      driver.region_ids?.length
        ? (
            await Promise.all(
              driver.region_ids.map((rid) => deliveryRegionRepository.findById(rid))
            )
          ).filter(Boolean)
        : [];
    return { ...driver, profile: profile ?? undefined, regions: regions as DeliveryDriver['regions'] };
  }
}

export const deliveryDriverAdminService = new DeliveryDriverAdminService();
