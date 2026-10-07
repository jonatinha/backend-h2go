import { Address } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

let memoryAddresses: Address[] = [];

export class AddressRepository {
  async findByUserId(userId: string): Promise<Address[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('addresses')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase addresses query error, using local fallback:', err);
      }
    }

    return memoryAddresses
      .filter((a) => a.user_id === userId)
      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
  }

  async findById(id: string, userId?: string): Promise<Address | null> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin.from('addresses').select('*').eq('id', id);
        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query.maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase address findById error, using local fallback:', err);
      }
    }

    const addr = memoryAddresses.find((a) => a.id === id && (!userId || a.user_id === userId));
    return addr ? { ...addr } : null;
  }

  async create(addressData: Omit<Address, 'id' | 'created_at' | 'updated_at'>): Promise<Address> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    if (addressData.is_default) {
      await this.unsetDefault(addressData.user_id);
    }

    const newAddress: Address = {
      id,
      ...addressData,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('addresses')
          .insert(newAddress)
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase address create error, using local fallback:', err);
      }
    }

    memoryAddresses.push(newAddress);
    return newAddress;
  }

  async update(id: string, userId: string, addressData: Partial<Address>): Promise<Address | null> {
    const now = new Date().toISOString();

    if (addressData.is_default) {
      await this.unsetDefault(userId);
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('addresses')
          .update({ ...addressData, updated_at: now })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase address update error, using local fallback:', err);
      }
    }

    const idx = memoryAddresses.findIndex((a) => a.id === id && a.user_id === userId);
    if (idx === -1) return null;

    memoryAddresses[idx] = {
      ...memoryAddresses[idx],
      ...addressData,
      updated_at: now,
    };
    return { ...memoryAddresses[idx] };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabaseAdmin
          .from('addresses')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);

        if (!error) return true;
      } catch (err) {
        console.warn('Supabase address delete error, using local fallback:', err);
      }
    }

    const initialLen = memoryAddresses.length;
    memoryAddresses = memoryAddresses.filter((a) => !(a.id === id && a.user_id === userId));
    return memoryAddresses.length < initialLen;
  }

  private async unsetDefault(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabaseAdmin
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase unsetDefault error:', err);
      }
    }

    for (const a of memoryAddresses) {
      if (a.user_id === userId) {
        a.is_default = false;
      }
    }
  }
}

export const addressRepository = new AddressRepository();
