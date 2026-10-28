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

export class DriverAdminError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DriverAdminError';
  }
}

function roleLabel(role: UserProfile['role']): string {
  if (role === 'admin') return 'administrador';
  if (role === 'delivery') return 'entregador';
  return 'usuário';
}

export class DeliveryDriverAdminService {
  async createDriver(input: CreateDriverInput): Promise<DeliveryDriver> {
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);

    if (existing) {
      return this.promoteExistingAccount(existing, input);
    }

    return this.createNewDriverAccount(email, input);
  }

  private async promoteExistingAccount(
    existing: UserProfile,
    input: CreateDriverInput
  ): Promise<DeliveryDriver> {
    if (existing.role === 'customer') {
      throw new DriverAdminError(
        'CUSTOMER_CANNOT_PROMOTE',
        'Este e-mail pertence a um cliente da loja. Não é possível torná-lo entregador por aqui.'
      );
    }

    const existingDriver = await deliveryDriverRepository.findByProfileId(existing.id);
    if (existingDriver) {
      throw new DriverAdminError(
        'ALREADY_DRIVER',
        'Este usuário já está cadastrado como entregador.'
      );
    }

    if (!input.promote_existing) {
      throw new DriverAdminError(
        'PROMOTE_DRIVER',
        `Já existe uma conta de ${roleLabel(existing.role)} com este e-mail. Deseja conceder o cargo de entregador?`
      );
    }

    if (!isSupabaseConfigured() && process.env.NODE_ENV !== 'test') {
      throw new Error('AUTH_UNAVAILABLE: Supabase necessário para criar entregador.');
    }

    const profileId = existing.id;

    await userRepository.updateProfile(profileId, {
      full_name: input.full_name,
      phone: input.phone ?? null,
      role: 'delivery',
      is_active: input.is_active ?? true,
    });

    if (process.env.NODE_ENV !== 'test' && isSupabaseConfigured()) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
        password: input.password,
        user_metadata: {
          full_name: input.full_name,
          phone: input.phone,
          role: 'delivery',
        },
      });
      if (error) {
        throw new Error(`AUTH_ERROR: ${error.message}`);
      }
    }

    return this.insertDriverRow(profileId, input);
  }

  private async createNewDriverAccount(
    email: string,
    input: CreateDriverInput
  ): Promise<DeliveryDriver> {
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

    return this.insertDriverRow(profileId, input);
  }

  private async insertDriverRow(
    profileId: string,
    input: CreateDriverInput
  ): Promise<DeliveryDriver> {
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
