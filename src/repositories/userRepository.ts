import { UserProfile, UserRole } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

const isTest = process.env.NODE_ENV === 'test';

let memoryUsers: UserProfile[] = isTest
  ? [
      {
        id: 'c0000000-0000-0000-0000-000000000001',
        email: 'admin@h2go.com.br',
        full_name: 'Administrador de teste',
        phone: '15999990000',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'c0000000-0000-0000-0000-000000000002',
        email: 'cliente@h2go.com.br',
        full_name: 'Cliente de teste',
        phone: '15998881111',
        role: 'customer',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
  : [];

function ensureSupabase(): void {
  if (!isTest && !isSupabaseConfigured()) {
    throw new Error('Supabase não configurado; operação de usuários indisponível.');
  }
}

export class UserRepository {
  async findById(id: string): Promise<UserProfile | null> {
    if (isTest) {
      const user = memoryUsers.find((u) => u.id === id);
      return user ? { ...user } : null;
    }

    ensureSupabase();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Falha ao consultar perfil por ID: ${error.message}`);
    return data ?? null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    if (isTest) {
      const user = memoryUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      return user ? { ...user } : null;
    }

    ensureSupabase();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) throw new Error(`Falha ao consultar perfil por e-mail: ${error.message}`);
    return data ?? null;
  }

  async createProfile(
    profile: Omit<UserProfile, 'created_at' | 'updated_at'>
  ): Promise<UserProfile> {
    const now = new Date().toISOString();
    const fullProfile: UserProfile = {
      ...profile,
      email: profile.email.toLowerCase(),
      created_at: now,
      updated_at: now,
    };

    if (isTest) {
      const idx = memoryUsers.findIndex((u) => u.id === profile.id);
      if (idx >= 0) memoryUsers[idx] = fullProfile;
      else memoryUsers.push(fullProfile);
      return { ...fullProfile };
    }

    ensureSupabase();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(fullProfile, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar perfil: ${error.message}`);
    if (!data) throw new Error('Supabase não retornou o perfil criado.');
    return data;
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

    if (isTest) {
      let filtered = [...memoryUsers];
      if (options?.role) {
        filtered = filtered.filter((u) => u.role === options.role);
      }
      const total = filtered.length;
      return { users: filtered.slice(from, to + 1), total };
    }

    ensureSupabase();
    let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' });
    if (options?.role) query = query.eq('role', options.role);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar perfis: ${error.message}`);
    return { users: data ?? [], total: count ?? data?.length ?? 0 };
  }

  async count(): Promise<number> {
    if (isTest) return memoryUsers.length;

    ensureSupabase();
    const { count, error } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) throw new Error(`Falha ao contar perfis: ${error.message}`);
    if (count === null) throw new Error('Supabase não retornou a contagem de perfis.');
    return count;
  }
}

export const userRepository = new UserRepository();
