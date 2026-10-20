import { Payment, PaymentStatus, PaymentMethod } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

let memoryPayments: Payment[] = [];
let memoryPaymentEvents: any[] = [];

export class PaymentRepository {
  async findById(id: string): Promise<Payment | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return { ...data, amount: Number(data.amount) };
        }
      } catch (err) {
        console.warn('Supabase payment findById error:', err);
      }
    }

    const p = memoryPayments.find((p) => p.id === id);
    return p ? { ...p } : null;
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (!error && data) {
          return { ...data, amount: Number(data.amount) };
        }
      } catch (err) {
        console.warn('Supabase payment findByOrderId error:', err);
      }
    }

    const p = memoryPayments.find((p) => p.order_id === orderId);
    return p ? { ...p } : null;
  }

  async create(paymentData: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<Payment> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const newPayment: Payment = {
      id,
      ...paymentData,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAdmin
          .from('payments')
          .insert({
            id: newPayment.id,
            order_id: newPayment.order_id,
            provider: newPayment.provider,
            external_id: newPayment.external_id,
            method: newPayment.method,
            status: newPayment.status,
            amount: newPayment.amount,
            currency: newPayment.currency,
            paid_at: newPayment.paid_at,
            expires_at: newPayment.expires_at,
            metadata: newPayment.metadata,
          })
          .select()
          .single();

        if (!error && data) {
          return { ...data, amount: Number(data.amount) };
        }
      } catch (err) {
        console.warn('Supabase payment create error:', err);
      }
    }

    memoryPayments.push(newPayment);
    return newPayment;
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    paidAt?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<Payment | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const updateData: any = { status, updated_at: now };
        if (paidAt !== undefined) updateData.paid_at = paidAt;
        if (metadata) updateData.metadata = metadata;

        const { data, error } = await supabaseAdmin
          .from('payments')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return { ...data, amount: Number(data.amount) };
        }
      } catch (err) {
        console.warn('Supabase payment updateStatus error:', err);
      }
    }

    const p = memoryPayments.find((item) => item.id === id);
    if (!p) return null;

    p.status = status;
    p.updated_at = now;
    if (paidAt !== undefined) p.paid_at = paidAt;
    if (metadata) p.metadata = { ...p.metadata, ...metadata };

    return { ...p };
  }

  async createEvent(
    paymentId: string,
    eventType: string,
    payload: Record<string, unknown>,
    providerEventId?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        await supabaseAdmin.from('payment_events').insert({
          payment_id: paymentId,
          event_type: eventType,
          provider_event_id: providerEventId,
          payload,
          processed: true,
        });
        return;
      } catch (err) {
        console.warn('Supabase createEvent error:', err);
      }
    }

    memoryPaymentEvents.push({
      id: crypto.randomUUID(),
      payment_id: paymentId,
      event_type: eventType,
      provider_event_id: providerEventId || null,
      payload,
      processed: true,
      created_at: now,
    });
  }
}

export const paymentRepository = new PaymentRepository();
