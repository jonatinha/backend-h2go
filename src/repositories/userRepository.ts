import { UserProfile, UserRole } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

let memoryUsers: UserProfile[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    email: 'admin@h2go.com.br',
    full_name: 'Administrador H2GO',
    phone: '15999990000',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    email: 'cliente@h2go.com.br',
    full_name: 'Cliente Demonstração',
    phone: '15998881111',
    role: 'customer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class UserRepository {
  async findById(id: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase user findById error:', err);
      }
    }

    const user = memoryUsers.find((u) => u.id === id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase user findByEmail error:', err);
      }
    }

    const user = memoryUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return user ? { ...user } : null;
  }

  async createProfile(profile: Omit<UserProfile, 'created_at' | 'updated_at'>): Promise<UserProfile> {
    const now = new Date().toISOString();
    const fullProfile: UserProfile = {
      ...profile,
      email: profile.email.toLowerCase(),
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .upsert(fullProfile, { onConflict: 'id' })
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase createProfile error:', err);
      }
    }

    const idx = memoryUsers.findIndex((u) => u.id === profile.id);
    if (idx >= 0) {
      memoryUsers[idx] = fullProfile;
    } else {
      memoryUsers.push(fullProfile);
    }
    return fullProfile;
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    role?: UserRole;
  }): Promise<{ users: UserProfile[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' });
        if (options?.role) query = query.eq('role', options.role);

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (!error && data) {
          return { users: data, total: count || data.length };
        }
      } catch (err) {
        console.warn('Supabase findAll users error:', err);
      }
    }

    let filtered = [...memoryUsers];
    if (options?.role) {
      filtered = filtered.filter((u) => u.role === options.role);
    }

    const total = filtered.length;
    const paginated = filtered.slice(from, to + 1);
    return { users: paginated, total };
  }

  async count(): Promise<number> {
    if (isSupabaseConfigured()) {
      try {
        const { count, error } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (!error && count !== null) return count;
      } catch (err) {
        // fallback
      }
    }
    return memoryUsers.length;
  }
}

export const userRepository = new UserRepository();
