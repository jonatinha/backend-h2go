import type {
  DeliveryDriver,
  DeliveryRegion,
  DeliveryAssignment,
  DeliveryAssignmentStatus,
} from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

const isTest = process.env.NODE_ENV === 'test';

let memoryDrivers: DeliveryDriver[] = [];
let memoryRegions: DeliveryRegion[] = [];
let memoryDriverRegions: { driver_id: string; region_id: string }[] = [];
let memoryAssignments: DeliveryAssignment[] = [];

function mapDriver(row: Record<string, unknown>): DeliveryDriver {
  return {
    id: String(row.id),
    profile_id: String(row.profile_id),
    vehicle_type: (row.vehicle_type as string) ?? null,
    vehicle_brand: (row.vehicle_brand as string) ?? null,
    vehicle_model: (row.vehicle_model as string) ?? null,
    vehicle_color: (row.vehicle_color as string) ?? null,
    vehicle_plate: (row.vehicle_plate as string) ?? null,
    avatar_url: (row.avatar_url as string) ?? null,
    max_distance_km: row.max_distance_km != null ? Number(row.max_distance_km) : null,
    max_units: row.max_units != null ? Number(row.max_units) : null,
    allowed_category_ids: Array.isArray(row.allowed_category_ids)
      ? (row.allowed_category_ids as string[])
      : [],
    rules_override:
      row.rules_override && typeof row.rules_override === 'object'
        ? (row.rules_override as Record<string, unknown>)
        : {},
    deliveries_count: Number(row.deliveries_count ?? 0),
    is_active: row.is_active !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    profile: row.profile as DeliveryDriver['profile'],
  };
}

export class DeliveryDriverRepository {
  async findById(id: string): Promise<DeliveryDriver | null> {
    if (isTest || !isSupabaseConfigured()) {
      const d = memoryDrivers.find((x) => x.id === id);
      return d ? { ...d, region_ids: this.regionIdsFor(id) } : null;
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_drivers')
      .select('*, profile:profiles(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar entregador: ${error.message}`);
    if (!data) return null;
    const driver = mapDriver(data as Record<string, unknown>);
    driver.region_ids = await this.listRegionIdsForDriver(id);
    return driver;
  }

  async findByProfileId(profileId: string): Promise<DeliveryDriver | null> {
    if (isTest || !isSupabaseConfigured()) {
      const d = memoryDrivers.find((x) => x.profile_id === profileId);
      return d ? { ...d, region_ids: this.regionIdsFor(d.id) } : null;
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_drivers')
      .select('*, profile:profiles(*)')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar entregador: ${error.message}`);
    if (!data) return null;
    const driver = mapDriver(data as Record<string, unknown>);
    driver.region_ids = await this.listRegionIdsForDriver(driver.id);
    return driver;
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    region_id?: string;
  }): Promise<{ drivers: DeliveryDriver[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isTest || !isSupabaseConfigured()) {
      let rows = [...memoryDrivers];
      if (options?.is_active !== undefined) {
        rows = rows.filter((d) => d.is_active === options.is_active);
      }
      if (options?.search) {
        const q = options.search.toLowerCase();
        rows = rows.filter(
          (d) =>
            d.profile?.full_name?.toLowerCase().includes(q) ||
            d.profile?.email?.toLowerCase().includes(q) ||
            d.vehicle_plate?.toLowerCase().includes(q)
        );
      }
      const total = rows.length;
      const slice = rows.slice(from, to + 1).map((d) => ({
        ...d,
        region_ids: this.regionIdsFor(d.id),
      }));
      return { drivers: slice, total };
    }

    let query = supabaseAdmin
      .from('delivery_drivers')
      .select('*, profile:profiles(*)', { count: 'exact' });

    if (options?.is_active !== undefined) {
      query = query.eq('is_active', options.is_active);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar entregadores: ${error.message}`);

    const drivers = await Promise.all(
      (data ?? []).map(async (row) => {
        const driver = mapDriver(row as Record<string, unknown>);
        driver.region_ids = await this.listRegionIdsForDriver(driver.id);
        return driver;
      })
    );

    return { drivers, total: count ?? drivers.length };
  }

  async create(
    input: Omit<DeliveryDriver, 'id' | 'deliveries_count' | 'created_at' | 'updated_at'> & {
      id?: string;
    }
  ): Promise<DeliveryDriver> {
    const now = new Date().toISOString();
    const row: DeliveryDriver = {
      id: input.id ?? crypto.randomUUID(),
      profile_id: input.profile_id,
      vehicle_type: input.vehicle_type,
      vehicle_brand: input.vehicle_brand,
      vehicle_model: input.vehicle_model,
      vehicle_color: input.vehicle_color,
      vehicle_plate: input.vehicle_plate,
      avatar_url: input.avatar_url,
      max_distance_km: input.max_distance_km,
      max_units: input.max_units,
      allowed_category_ids: input.allowed_category_ids ?? [],
      rules_override: input.rules_override ?? {},
      deliveries_count: 0,
      is_active: input.is_active ?? true,
      created_at: now,
      updated_at: now,
      profile: input.profile,
    };

    if (isTest || !isSupabaseConfigured()) {
      memoryDrivers.push(row);
      return { ...row };
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_drivers')
      .insert({
        id: row.id,
        profile_id: row.profile_id,
        vehicle_type: row.vehicle_type,
        vehicle_brand: row.vehicle_brand,
        vehicle_model: row.vehicle_model,
        vehicle_color: row.vehicle_color,
        vehicle_plate: row.vehicle_plate,
        avatar_url: row.avatar_url,
        max_distance_km: row.max_distance_km,
        max_units: row.max_units,
        allowed_category_ids: row.allowed_category_ids,
        rules_override: row.rules_override,
        is_active: row.is_active,
      })
      .select('*, profile:profiles(*)')
      .single();

    if (error) throw new Error(`Falha ao criar entregador: ${error.message}`);
    return mapDriver(data as Record<string, unknown>);
  }

  async update(
    id: string,
    updates: Partial<
      Pick<
        DeliveryDriver,
        | 'vehicle_type'
        | 'vehicle_brand'
        | 'vehicle_model'
        | 'vehicle_color'
        | 'vehicle_plate'
        | 'avatar_url'
        | 'max_distance_km'
        | 'max_units'
        | 'allowed_category_ids'
        | 'rules_override'
        | 'is_active'
      >
    >
  ): Promise<DeliveryDriver | null> {
    const now = new Date().toISOString();

    if (isTest || !isSupabaseConfigured()) {
      const idx = memoryDrivers.findIndex((d) => d.id === id);
      if (idx === -1) return null;
      memoryDrivers[idx] = { ...memoryDrivers[idx], ...updates, updated_at: now };
      return { ...memoryDrivers[idx], region_ids: this.regionIdsFor(id) };
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_drivers')
      .update({ ...updates, updated_at: now })
      .eq('id', id)
      .select('*, profile:profiles(*)')
      .maybeSingle();

    if (error) throw new Error(`Falha ao atualizar entregador: ${error.message}`);
    if (!data) return null;
    const driver = mapDriver(data as Record<string, unknown>);
    driver.region_ids = await this.listRegionIdsForDriver(id);
    return driver;
  }

  async setRegions(driverId: string, regionIds: string[]): Promise<void> {
    if (isTest || !isSupabaseConfigured()) {
      memoryDriverRegions = memoryDriverRegions.filter((r) => r.driver_id !== driverId);
      for (const region_id of regionIds) {
        memoryDriverRegions.push({ driver_id: driverId, region_id });
      }
      return;
    }

    await supabaseAdmin.from('delivery_driver_regions').delete().eq('driver_id', driverId);
    if (regionIds.length === 0) return;

    const { error } = await supabaseAdmin.from('delivery_driver_regions').insert(
      regionIds.map((region_id) => ({ driver_id: driverId, region_id }))
    );
    if (error) throw new Error(`Falha ao vincular regiões: ${error.message}`);
  }

  async listRegionIdsForDriver(driverId: string): Promise<string[]> {
    if (isTest || !isSupabaseConfigured()) {
      return this.regionIdsFor(driverId);
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_driver_regions')
      .select('region_id')
      .eq('driver_id', driverId);

    if (error) throw new Error(`Falha ao listar regiões do entregador: ${error.message}`);
    return (data ?? []).map((r) => String(r.region_id));
  }

  async incrementDeliveriesCount(driverId: string): Promise<void> {
    if (isTest || !isSupabaseConfigured()) {
      const d = memoryDrivers.find((x) => x.id === driverId);
      if (d) d.deliveries_count += 1;
      return;
    }

    const { data } = await supabaseAdmin
      .from('delivery_drivers')
      .select('deliveries_count')
      .eq('id', driverId)
      .maybeSingle();

    const next = Number(data?.deliveries_count ?? 0) + 1;
    await supabaseAdmin
      .from('delivery_drivers')
      .update({ deliveries_count: next, updated_at: new Date().toISOString() })
      .eq('id', driverId);
  }

  private regionIdsFor(driverId: string): string[] {
    return memoryDriverRegions.filter((r) => r.driver_id === driverId).map((r) => r.region_id);
  }

  /** Test helpers */
  resetMemory(): void {
    memoryDrivers = [];
    memoryRegions = [];
    memoryDriverRegions = [];
    memoryAssignments = [];
  }

  seedMemory(driver: DeliveryDriver, regionIds: string[] = []): void {
    memoryDrivers.push(driver);
    for (const region_id of regionIds) {
      memoryDriverRegions.push({ driver_id: driver.id, region_id });
    }
  }
}

export class DeliveryRegionRepository {
  async findById(id: string): Promise<DeliveryRegion | null> {
    if (isTest || !isSupabaseConfigured()) {
      const r = memoryRegions.find((x) => x.id === id);
      return r ? { ...r } : null;
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_regions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapRegion(data) : null;
  }

  async findAllActive(): Promise<DeliveryRegion[]> {
    if (isTest || !isSupabaseConfigured()) {
      return memoryRegions.filter((r) => r.is_active).map((r) => ({ ...r }));
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_regions')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => this.mapRegion(r));
  }

  async findAll(options?: { page?: number; limit?: number; search?: string }): Promise<{
    regions: DeliveryRegion[];
    total: number;
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isTest || !isSupabaseConfigured()) {
      let rows = [...memoryRegions];
      if (options?.search) {
        const q = options.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.code.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q)
        );
      }
      return { regions: rows.slice(from, to + 1), total: rows.length };
    }

    let query = supabaseAdmin.from('delivery_regions').select('*', { count: 'exact' });
    const { data, count, error } = await query.order('name').range(from, to);
    if (error) throw new Error(error.message);
    return { regions: (data ?? []).map((r) => this.mapRegion(r)), total: count ?? 0 };
  }

  async create(
    input: Omit<DeliveryRegion, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DeliveryRegion> {
    const now = new Date().toISOString();
    const row: DeliveryRegion = {
      ...input,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };

    if (isTest || !isSupabaseConfigured()) {
      memoryRegions.push(row);
      return { ...row };
    }

    const { data, error } = await supabaseAdmin.from('delivery_regions').insert(row).select().single();
    if (error) throw new Error(error.message);
    return this.mapRegion(data);
  }

  async update(id: string, updates: Partial<DeliveryRegion>): Promise<DeliveryRegion | null> {
    const now = new Date().toISOString();
    if (isTest || !isSupabaseConfigured()) {
      const idx = memoryRegions.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      memoryRegions[idx] = { ...memoryRegions[idx], ...updates, updated_at: now };
      return { ...memoryRegions[idx] };
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_regions')
      .update({ ...updates, updated_at: now })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapRegion(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (isTest || !isSupabaseConfigured()) {
      const before = memoryRegions.length;
      memoryRegions = memoryRegions.filter((r) => r.id !== id);
      return memoryRegions.length < before;
    }

    const { error } = await supabaseAdmin.from('delivery_regions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  seedMemory(region: DeliveryRegion): void {
    memoryRegions.push(region);
  }

  resetMemory(): void {
    memoryRegions = [];
  }

  private mapRegion(data: Record<string, unknown>): DeliveryRegion {
    return {
      id: String(data.id),
      code: String(data.code),
      name: String(data.name),
      description: (data.description as string) ?? null,
      boundary_type: data.boundary_type as DeliveryRegion['boundary_type'],
      geometry: (data.geometry as Record<string, unknown>) ?? {},
      center_lat: data.center_lat != null ? Number(data.center_lat) : null,
      center_lng: data.center_lng != null ? Number(data.center_lng) : null,
      radius_km: data.radius_km != null ? Number(data.radius_km) : null,
      neighborhoods: Array.isArray(data.neighborhoods) ? (data.neighborhoods as string[]) : [],
      is_active: data.is_active !== false,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    };
  }
}

export class DeliveryAssignmentRepository {
  async findByOrderId(orderId: string): Promise<DeliveryAssignment | null> {
    if (isTest || !isSupabaseConfigured()) {
      const a = memoryAssignments.find((x) => x.order_id === orderId);
      return a ? { ...a } : null;
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_assignments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.map(data) : null;
  }

  async findActiveByDriver(driverId: string): Promise<DeliveryAssignment[]> {
    const active: DeliveryAssignmentStatus[] = [
      'accepted',
      'en_route_pickup',
      'picked_up',
      'en_route_delivery',
    ];

    if (isTest || !isSupabaseConfigured()) {
      return memoryAssignments.filter(
        (a) => a.driver_id === driverId && active.includes(a.status)
      );
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_assignments')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', active)
      .order('accepted_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => this.map(r));
  }

  async updateStatus(
    id: string,
    status: DeliveryAssignmentStatus,
    extra?: Partial<DeliveryAssignment>
  ): Promise<DeliveryAssignment | null> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now, ...extra };
    if (status === 'completed') patch.completed_at = now;
    if (status === 'cancelled') patch.cancelled_at = now;

    if (isTest || !isSupabaseConfigured()) {
      const idx = memoryAssignments.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      memoryAssignments[idx] = { ...memoryAssignments[idx], ...patch } as DeliveryAssignment;
      return { ...memoryAssignments[idx] };
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_assignments')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.map(data) : null;
  }

  async acceptAtomic(orderId: string, driverId: string): Promise<string> {
    if (isTest || !isSupabaseConfigured()) {
      const orderTaken = memoryAssignments.some((a) => a.order_id === orderId);
      if (orderTaken) throw new Error('ORDER_NOT_AVAILABLE');
      const id = crypto.randomUUID();
      memoryAssignments.push({
        id,
        order_id: orderId,
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        completed_at: null,
        cancelled_at: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return id;
    }

    const { data, error } = await supabaseAdmin.rpc('accept_delivery_order', {
      p_order_id: orderId,
      p_driver_id: driverId,
    });

    if (error) {
      if (error.message.includes('ORDER_NOT_AVAILABLE')) {
        throw new Error('ORDER_NOT_AVAILABLE: Corrida indisponível ou já aceita.');
      }
      throw new Error(`Falha ao aceitar corrida: ${error.message}`);
    }

    return String(data);
  }

  seedMemory(assignment: DeliveryAssignment): void {
    memoryAssignments.push(assignment);
  }

  resetMemory(): void {
    memoryAssignments = [];
  }

  private map(data: Record<string, unknown>): DeliveryAssignment {
    return {
      id: String(data.id),
      order_id: String(data.order_id),
      driver_id: String(data.driver_id),
      status: data.status as DeliveryAssignmentStatus,
      accepted_at: String(data.accepted_at),
      completed_at: (data.completed_at as string) ?? null,
      cancelled_at: (data.cancelled_at as string) ?? null,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    };
  }
}

export const deliveryDriverRepository = new DeliveryDriverRepository();
export const deliveryRegionRepository = new DeliveryRegionRepository();
export const deliveryAssignmentRepository = new DeliveryAssignmentRepository();
