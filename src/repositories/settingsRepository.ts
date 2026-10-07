import { SystemSetting } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';
import { INITIAL_SETTINGS } from './initialData.js';

let memorySettings: SystemSetting[] = JSON.parse(JSON.stringify(INITIAL_SETTINGS));

export class SettingsRepository {
  async getAll(): Promise<SystemSetting[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('system_settings')
          .select('*')
          .order('key', { ascending: true });

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase settings query error, using local fallback:', err);
      }
    }
    return [...memorySettings];
  }

  async getByKey(key: string): Promise<string | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('system_settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data) return data.value;
      } catch (err) {
        console.warn('Supabase getByKey error, using local fallback:', err);
      }
    }

    const setting = memorySettings.find((s) => s.key === key);
    return setting ? setting.value : null;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.getByKey(key);
    if (!val) return defaultValue;
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  }

  async setKey(key: string, value: string, description?: string, isPublic: boolean = true): Promise<SystemSetting> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('system_settings')
          .upsert(
            { key, value, description, is_public: isPublic, updated_at: now },
            { onConflict: 'key' }
          )
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase setKey error, using local fallback:', err);
      }
    }

    const existing = memorySettings.find((s) => s.key === key);
    if (existing) {
      existing.value = value;
      if (description) existing.description = description;
      existing.updated_at = now;
      return { ...existing };
    } else {
      const newSetting: SystemSetting = {
        id: crypto.randomUUID(),
        key,
        value,
        description: description || null,
        is_public: isPublic,
        created_at: now,
        updated_at: now,
      };
      memorySettings.push(newSetting);
      return newSetting;
    }
  }
}

export const settingsRepository = new SettingsRepository();
