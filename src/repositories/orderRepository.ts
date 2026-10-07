import { Order, OrderItem, OrderStatus } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';
import { calculatePackage } from '../utils/fardo.js';

let memoryOrders: Order[] = [];
let memoryOrderItems: OrderItem[] = [];

export class OrderRepository {
  async findByIdempotencyKey(key: string): Promise<Order | null> {
    if (!key) return null;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .select('*, items:order_items(*), address:addresses(*)')
          .eq('idempotency_key', key)
          .maybeSingle();

        if (!error && data) {
          return this.mapOrder(data);
        }
      } catch (err) {
        console.warn('Supabase idempotency query error:', err);
      }
    }

    const found = memoryOrders.find((o) => o.idempotency_key === key);
    if (!found) return null;
    return this.enrichMemoryOrder(found);
  }

  async findById(id: string, userId?: string): Promise<Order | null> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin
          .from('orders')
          .select('*, items:order_items(*), address:addresses(*)')
          .eq('id', id);

        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          return this.mapOrder(data);
        }
      } catch (err) {
        console.warn('Supabase order findById error:', err);
      }
    }

    const found = memoryOrders.find((o) => o.id === id && (!userId || o.user_id === userId));
    if (!found) return null;
    return this.enrichMemoryOrder(found);
  }

  async findByUserId(
    userId: string,
    options?: { page?: number; limit?: number; status?: OrderStatus }
  ): Promise<{ orders: Order[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin
          .from('orders')
          .select('*, items:order_items(*), address:addresses(*)', { count: 'exact' })
          .eq('user_id', userId);

        if (options?.status) {
          query = query.eq('status', options.status);
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (!error && data) {
          return {
            orders: data.map(this.mapOrder),
            total: count || data.length,
          };
        }
      } catch (err) {
        console.warn('Supabase orders query error:', err);
      }
    }

    let filtered = memoryOrders.filter((o) => o.user_id === userId);
    if (options?.status) {
      filtered = filtered.filter((o) => o.status === options.status);
    }
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(from, to + 1).map(this.enrichMemoryOrder);
    return { orders: paginated, total };
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
  }): Promise<{ orders: Order[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin
          .from('orders')
          .select('*, items:order_items(*), address:addresses(*)', { count: 'exact' });

        if (options?.status) {
          query = query.eq('status', options.status);
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (!error && data) {
          return {
            orders: data.map(this.mapOrder),
            total: count || data.length,
          };
        }
      } catch (err) {
        console.warn('Supabase admin orders query error:', err);
      }
    }

    let filtered = [...memoryOrders];
    if (options?.status) {
      filtered = filtered.filter((o) => o.status === options.status);
    }
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(from, to + 1).map(this.enrichMemoryOrder);
    return { orders: paginated, total };
  }

  async create(
    orderData: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'items'>,
    itemsData: Array<Omit<OrderItem, 'id' | 'order_id' | 'created_at'>>
  ): Promise<Order> {
    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();

    const newOrder: Order = {
      id: orderId,
      ...orderData,
      created_at: now,
      updated_at: now,
    };

    const newItems: OrderItem[] = itemsData.map((item) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      ...item,
      created_at: now,
    }));

    if (isSupabaseConfigured()) {
      try {
        const { error: orderError } = await supabaseAdmin.from('orders').insert({
          id: newOrder.id,
          user_id: newOrder.user_id,
          address_id: newOrder.address_id,
          status: newOrder.status,
          subtotal: newOrder.subtotal,
          shipping_fee: newOrder.shipping_fee,
          discount: newOrder.discount,
          total: newOrder.total,
          currency: newOrder.currency,
          notes: newOrder.notes,
          idempotency_key: newOrder.idempotency_key,
        });

        if (!orderError) {
          await supabaseAdmin.from('order_items').insert(
            newItems.map((i) => ({
              id: i.id,
              order_id: i.order_id,
              product_id: i.product_id,
              product_name: i.product_name,
              sku: i.sku,
              quantity: i.quantity,
              unit_price: i.unit_price,
              subtotal: i.subtotal,
            }))
          );
        }
      } catch (err) {
        console.warn('Supabase createOrder error, storing locally:', err);
      }
    }

    memoryOrders.push(newOrder);
    memoryOrderItems.push(...newItems);

    return {
      ...newOrder,
      items: newItems,
    };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .update({ status, updated_at: now })
          .eq('id', id)
          .select('*, items:order_items(*), address:addresses(*)')
          .single();

        if (!error && data) return this.mapOrder(data);
      } catch (err) {
        console.warn('Supabase updateStatus error:', err);
      }
    }

    const order = memoryOrders.find((o) => o.id === id);
    if (!order) return null;

    order.status = status;
    order.updated_at = now;
    return this.enrichMemoryOrder(order);
  }

  private mapOrder(data: any): Order {
    return {
      ...data,
      subtotal: Number(data.subtotal),
      shipping_fee: Number(data.shipping_fee),
      discount: Number(data.discount),
      total: Number(data.total),
      items: (data.items || []).map((i: any) => ({
        ...i,
        unit_price: Number(i.unit_price),
        subtotal: Number(i.subtotal),
        package_info: calculatePackage(i.sku, i.quantity),
      })),
    };
  }

  private enrichMemoryOrder(order: Order): Order {
    const items = memoryOrderItems
      .filter((i) => i.order_id === order.id)
      .map((i) => ({
        ...i,
        package_info: calculatePackage(i.sku, i.quantity),
      }));
    return {
      ...order,
      items,
    };
  }
}

export const orderRepository = new OrderRepository();
