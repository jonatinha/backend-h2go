import { Product } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';
import { INITIAL_PRODUCTS } from './initialData.js';

let memoryProducts: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));

export class ProductRepository {
  async findAll(options?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<{ products: Product[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin.from('products').select('*', { count: 'exact' });

        if (options?.categoryId) {
          query = query.eq('category_id', options.categoryId);
        }
        if (options?.isActive !== undefined) {
          query = query.eq('is_active', options.isActive);
        }
        if (options?.search) {
          query = query.ilike('name', `%${options.search}%`);
        }

        const { data, count, error } = await query
          .order('name', { ascending: true })
          .range(from, to);

        if (!error && data) {
          const products = data.map((p) => ({
            ...p,
            price: Number(p.price),
          }));
          return { products, total: count || products.length };
        }
      } catch (err) {
        console.warn('Supabase product query error, using local fallback:', err);
      }
    }

    let filtered = [...memoryProducts];
    if (options?.categoryId) {
      filtered = filtered.filter((p) => p.category_id === options.categoryId);
    }
    if (options?.isActive !== undefined) {
      filtered = filtered.filter((p) => p.is_active === options.isActive);
    }
    if (options?.search) {
      const search = options.search.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(from, to + 1);
    return { products: paginated, total };
  }

  async findById(id: string): Promise<Product | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return { ...data, price: Number(data.price) };
        }
      } catch (err) {
        console.warn('Supabase product findById error, using local fallback:', err);
      }
    }

    const found = memoryProducts.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (!error && data) {
          return { ...data, price: Number(data.price) };
        }
      } catch (err) {
        console.warn('Supabase product findBySlug error, using local fallback:', err);
      }
    }

    const found = memoryProducts.find((p) => p.slug === slug);
    return found ? { ...found } : null;
  }

  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newProduct: Product = {
      id,
      ...product,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('products')
          .insert({
            id: newProduct.id,
            category_id: newProduct.category_id,
            name: newProduct.name,
            slug: newProduct.slug,
            sku: newProduct.sku,
            description: newProduct.description,
            price: newProduct.price,
            unit: newProduct.unit,
            minimum_quantity: newProduct.minimum_quantity,
            maximum_quantity: newProduct.maximum_quantity,
            quantity_step: newProduct.quantity_step,
            package_size: newProduct.package_size,
            package_label: newProduct.package_label,
            image_url: newProduct.image_url,
            is_active: newProduct.is_active,
            stock_control_enabled: newProduct.stock_control_enabled,
            stock_quantity: newProduct.stock_quantity,
          })
          .select()
          .single();

        if (!error && data) {
          return { ...data, price: Number(data.price) };
        }
      } catch (err) {
        console.warn('Supabase product create error, saving locally:', err);
      }
    }

    memoryProducts.push(newProduct);
    return newProduct;
  }

  async update(id: string, productData: Partial<Product>): Promise<Product | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('products')
          .update({ ...productData, updated_at: now })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return { ...data, price: Number(data.price) };
        }
      } catch (err) {
        console.warn('Supabase product update error, updating locally:', err);
      }
    }

    const idx = memoryProducts.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    memoryProducts[idx] = {
      ...memoryProducts[idx],
      ...productData,
      updated_at: now,
    };
    return { ...memoryProducts[idx] };
  }

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.warn('Supabase product delete error, deleting locally:', err);
      }
    }

    const initialLength = memoryProducts.length;
    memoryProducts = memoryProducts.filter((p) => p.id !== id);
    return memoryProducts.length < initialLength;
  }
}

export const productRepository = new ProductRepository();
