import { Agency } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

let memoryAgencies: Agency[] = [];

function mapAgency(row: Record<string, unknown>): Agency {
  return {
    ...(row as unknown as Agency),
    opening_hours: (row.opening_hours as Record<string, unknown>) || {},
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    sort_order: Number(row.sort_order ?? 0),
  };
}

function useMemoryStore(): boolean {
  return process.env.NODE_ENV === 'test' && !isSupabaseConfigured();
}

function dbFailure(action: string, error: { message?: string; code?: string } | null): never {
  const detail = error?.message || error?.code || 'erro desconhecido';
  throw new Error(
    `AGENCY_DB_ERROR: Não foi possível ${action} no Supabase (${detail}). Verifique SUPABASE_SERVICE_ROLE_KEY na Vercel.`
  );
}

export class AgencyRepository {
  async findAll(options?: {
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
    activeOnly?: boolean;
    pickupOnly?: boolean;
  }): Promise<{ agencies: Agency[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      let query = supabaseAdmin.from('agencies').select('*', { count: 'exact' });

      if (options?.activeOnly !== false) {
        query = query.eq('is_active', true);
      }
      if (options?.pickupOnly !== false) {
        query = query.eq('accepts_pickup', true);
      }
      if (options?.city) {
        query = query.ilike('city', options.city.trim());
      }
      if (options?.state) {
        query = query.ilike('state', options.state.trim());
      }

      const { data, count, error } = await query
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .range(from, to);

      if (error) dbFailure('listar agências', error);
      return {
        agencies: (data || []).map((row) => mapAgency(row)),
        total: count ?? data?.length ?? 0,
      };
    }

    if (!useMemoryStore()) {
      throw new Error('AGENCY_DB_ERROR: Supabase não configurado para persistir agências.');
    }

    let filtered = [...memoryAgencies];
    if (options?.activeOnly !== false) {
      filtered = filtered.filter((a) => a.is_active);
    }
    if (options?.pickupOnly !== false) {
      filtered = filtered.filter((a) => a.accepts_pickup);
    }
    if (options?.city) {
      const city = options.city.trim().toLowerCase();
      filtered = filtered.filter((a) => a.city.toLowerCase() === city);
    }
    if (options?.state) {
      const state = options.state.trim().toUpperCase();
      filtered = filtered.filter((a) => a.state.toUpperCase() === state);
    }

    filtered.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const total = filtered.length;
    return { agencies: filtered.slice(from, to + 1), total };
  }

  async findById(id: string): Promise<Agency | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) dbFailure('buscar agência', error);
      return data ? mapAgency(data) : null;
    }

    if (!useMemoryStore()) return null;
    const found = memoryAgencies.find((a) => a.id === id);
    return found ? { ...found } : null;
  }

  async findBySlug(slug: string): Promise<Agency | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) dbFailure('buscar agência por slug', error);
      return data ? mapAgency(data) : null;
    }

    if (!useMemoryStore()) return null;
    const found = memoryAgencies.find((a) => a.slug === slug);
    return found ? { ...found } : null;
  }

  async create(
    agencyData: Omit<Agency, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Agency> {
    const now = new Date().toISOString();
    const row = {
      code: agencyData.code,
      name: agencyData.name,
      slug: agencyData.slug,
      phone: agencyData.phone,
      email: agencyData.email,
      cep: agencyData.cep,
      street: agencyData.street,
      number: agencyData.number,
      complement: agencyData.complement,
      neighborhood: agencyData.neighborhood,
      city: agencyData.city,
      state: agencyData.state,
      reference: agencyData.reference,
      latitude: agencyData.latitude,
      longitude: agencyData.longitude,
      pickup_instructions: agencyData.pickup_instructions,
      opening_hours: agencyData.opening_hours ?? {},
      accepts_pickup: agencyData.accepts_pickup,
      is_active: agencyData.is_active,
      sort_order: agencyData.sort_order,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .insert(row)
        .select()
        .single();

      if (error) dbFailure('cadastrar agência', error);
      if (!data) dbFailure('cadastrar agência', { message: 'resposta vazia do banco' });
      return mapAgency(data);
    }

    if (!useMemoryStore()) {
      throw new Error('AGENCY_DB_ERROR: Supabase não configurado para persistir agências.');
    }

    const newAgency: Agency = {
      id: crypto.randomUUID(),
      ...agencyData,
      created_at: now,
      updated_at: now,
    };
    memoryAgencies.push(newAgency);
    return newAgency;
  }

  async update(id: string, updates: Partial<Agency>): Promise<Agency | null> {
    const now = new Date().toISOString();
    const { id: _id, created_at: _c, ...safeUpdates } = updates;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .update({ ...safeUpdates, updated_at: now })
        .eq('id', id)
        .select()
        .single();

      if (error) dbFailure('atualizar agência', error);
      return data ? mapAgency(data) : null;
    }

    if (!useMemoryStore()) return null;

    const index = memoryAgencies.findIndex((a) => a.id === id);
    if (index === -1) return null;

    memoryAgencies[index] = {
      ...memoryAgencies[index],
      ...updates,
      updated_at: now,
    };
    return { ...memoryAgencies[index] };
  }

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const { error } = await supabaseAdmin.from('agencies').delete().eq('id', id);
      if (error) dbFailure('excluir agência', error);
      return true;
    }

    if (!useMemoryStore()) return false;

    const before = memoryAgencies.length;
    memoryAgencies = memoryAgencies.filter((a) => a.id !== id);
    return memoryAgencies.length < before;
  }
}

export const agencyRepository = new AgencyRepository();
