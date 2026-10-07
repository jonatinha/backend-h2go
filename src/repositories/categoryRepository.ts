import { Category } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';
import { INITIAL_CATEGORY } from './initialData.js';

let memoryCategories: Category[] = [JSON.parse(JSON.stringify(INITIAL_CATEGORY))];

export class CategoryRepository {
  async findAll(): Promise<Category[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('categories')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase category query error, using local fallback:', err);
      }
    }
    return [...memoryCategories];
  }

  async findById(id: string): Promise<Category | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('categories')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase category findById error, using local fallback:', err);
      }
    }
    const cat = memoryCategories.find((c) => c.id === id);
    return cat ? { ...cat } : null;
  }
}

export const categoryRepository = new CategoryRepository();
