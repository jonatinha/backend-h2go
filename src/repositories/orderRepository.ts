import { Order, OrderItem, OrderStatus, FulfillmentType } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';
import { calculatePackage } from '../utils/fardo.js';

const ORDER_DETAIL_SELECT =
  '*, items:order_items(*), address:addresses(*), agency:agencies(*)';

let memoryOrders: Order[] = [];
let memoryOrderItems: OrderItem[] = [];

export class OrderRepository {
  async findByIdempotencyKey(key: string): Promise<Order | null> {
    if (!key) return null;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .select(ORDER_DETAIL_SELECT)
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
          .select(ORDER_DETAIL_SELECT)
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
    options?: { page?: number; limit?: number; status?: OrderStatus; fulfillment_type?: FulfillmentType }
  ): Promise<{ orders: Order[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin
          .from('orders')
          .select(ORDER_DETAIL_SELECT, { count: 'exact' })
          .eq('user_id', userId);

        if (options?.status) {
          query = query.eq('status', options.status);
        }
        if (options?.fulfillment_type) {
          query = query.eq('fulfillment_type', options.fulfillment_type);
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
    if (options?.fulfillment_type) {
      filtered = filtered.filter((o) => o.fulfillment_type === options.fulfillment_type);
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
    fulfillment_type?: FulfillmentType;
    from?: string;
    to?: string;
    driver_id?: string;
    unassigned_only?: boolean;
  }): Promise<{ orders: Order[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (isSupabaseConfigured()) {
      try {
        let query = supabaseAdmin
          .from('orders')
          .select(ORDER_DETAIL_SELECT, { count: 'exact' });

        if (options?.status) {
          query = query.eq('status', options.status);
        }
        if (options?.fulfillment_type) {
          query = query.eq('fulfillment_type', options.fulfillment_type);
        }
        if (options?.from) query = query.gte('created_at', options.from);
        if (options?.to) query = query.lt('created_at', options.to);
        if (options?.driver_id) query = query.eq('driver_id', options.driver_id);
        if (options?.unassigned_only) query = query.is('driver_id', null);

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
    if (options?.fulfillment_type) {
      filtered = filtered.filter((o) => o.fulfillment_type === options.fulfillment_type);
    }
    if (options?.from) filtered = filtered.filter((o) => o.created_at >= options.from!);
    if (options?.to) filtered = filtered.filter((o) => o.created_at < options.to!);
    if (options?.driver_id) {
      filtered = filtered.filter((o) => o.driver_id === options.driver_id);
    }
    if (options?.unassigned_only) {
      filtered = filtered.filter((o) => !o.driver_id);
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
          fulfillment_type: newOrder.fulfillment_type,
          agency_id: newOrder.agency_id,
          pickup_contact_name: newOrder.pickup_contact_name,
          pickup_contact_phone: newOrder.pickup_contact_phone,
          pickup_scheduled_at: newOrder.pickup_scheduled_at,
          ready_for_pickup_at: newOrder.ready_for_pickup_at,
          picked_up_at: newOrder.picked_up_at,
          status: newOrder.status,
          subtotal: newOrder.subtotal,
          shipping_fee: newOrder.shipping_fee,
          discount: newOrder.discount,
          total: newOrder.total,
          currency: newOrder.currency,
          notes: newOrder.notes,
          idempotency_key: newOrder.idempotency_key,
          latitude: newOrder.latitude ?? null,
          longitude: newOrder.longitude ?? null,
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
    const existing = await this.findById(id);
    const patch: Record<string, unknown> = { status, updated_at: now };

    if (status === 'ready_for_pickup') {
      patch.ready_for_pickup_at = now;
    }
    if (status === 'delivered' && existing?.fulfillment_type === 'pickup') {
      patch.picked_up_at = now;
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .update(patch)
          .eq('id', id)
          .select(ORDER_DETAIL_SELECT)
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
    if (status === 'ready_for_pickup') {
      order.ready_for_pickup_at = now;
    }
    if (status === 'delivered' && order.fulfillment_type === 'pickup') {
      order.picked_up_at = now;
    }
    return this.enrichMemoryOrder(order);
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .update({ ...updates, updated_at: now })
          .eq('id', id)
          .select(ORDER_DETAIL_SELECT)
          .single();

        if (!error && data) return this.mapOrder(data);
      } catch (err) {
        console.warn('Supabase updateOrder error, updating locally:', err);
      }
    }

    const order = memoryOrders.find((o) => o.id === id);
    if (!order) return null;

    Object.assign(order, updates, { updated_at: now });
    return this.enrichMemoryOrder(order);
  }

  private mapOrder(data: any): Order {
    // Extrai latitude e longitude da tabela de orders, ou da tabela de addresses vinculada, ou das notas do pedido
    let lat = data.latitude ? Number(data.latitude) : (data.address?.latitude ? Number(data.address.latitude) : (data.addresses?.latitude ? Number(data.addresses.latitude) : null));
    let lng = data.longitude ? Number(data.longitude) : (data.address?.longitude ? Number(data.address.longitude) : (data.addresses?.longitude ? Number(data.addresses.longitude) : null));

    if ((!lat || !lng) && data.notes && typeof data.notes === 'string') {
      const match = data.notes.match(/Pin GPS:\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)/i);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }
    }

    const agency = data.agency || data.agencies || null;

    return {
      ...data,
      fulfillment_type: (data.fulfillment_type as FulfillmentType) || 'delivery',
      agency_id: data.agency_id ?? null,
      pickup_contact_name: data.pickup_contact_name ?? null,
      pickup_contact_phone: data.pickup_contact_phone ?? null,
      pickup_scheduled_at: data.pickup_scheduled_at ?? null,
      ready_for_pickup_at: data.ready_for_pickup_at ?? null,
      picked_up_at: data.picked_up_at ?? null,
      agency: agency || undefined,
      driver_id: data.driver_id ?? null,
      accepted_at: data.accepted_at ?? null,
      delivery_started_at: data.delivery_started_at ?? null,
      delivery_completed_at: data.delivery_completed_at ?? null,
      latitude: lat,
      longitude: lng,
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
