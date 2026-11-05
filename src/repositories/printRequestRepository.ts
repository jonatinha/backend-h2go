import type { PrintRequest, PrintRequestListItem } from '../types/printRequest.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

const memory: PrintRequest[] = [];

function mapRow(row: Record<string, unknown>): PrintRequest {
  return {
    id: String(row.id),
    receipt_id: String(row.receipt_id),
    order_id: String(row.order_id),
    queue_status: row.queue_status as PrintRequest['queue_status'],
    printed_at: row.printed_at ? String(row.printed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapListRow(row: Record<string, unknown>): PrintRequestListItem {
  const base = mapRow(row);
  const order = row.orders as Record<string, unknown> | null | undefined;
  const receipt = row.delivery_receipts as Record<string, unknown> | null | undefined;
  return {
    ...base,
    order_number: String(order?.order_number ?? '').slice(0, 8).toUpperCase(),
    order_status: String(order?.status ?? ''),
    receipt_number: String(receipt?.receipt_number ?? ''),
    payer_name: String(receipt?.payer_name ?? ''),
    amount: Number(receipt?.amount ?? 0),
  };
}

export class PrintRequestRepository {
  async create(receiptId: string, orderId: string): Promise<PrintRequest> {
    const now = new Date().toISOString();
    const existing = await this.findActiveByReceiptId(receiptId);
    if (existing) return existing;

    const row = {
      receipt_id: receiptId,
      order_id: orderId,
      queue_status: 'active' as const,
      printed_at: null,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin.from('print_requests').insert(row).select().single();
      if (error) {
        if (error.code === '23505') {
          const again = await this.findActiveByReceiptId(receiptId);
          if (again) return again;
        }
        throw new Error(error.message);
      }
      return mapRow(data);
    }

    const item: PrintRequest = { id: crypto.randomUUID(), ...row };
    memory.unshift(item);
    return item;
  }

  async findActiveByReceiptId(receiptId: string): Promise<PrintRequest | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('print_requests')
        .select('*')
        .eq('receipt_id', receiptId)
        .eq('queue_status', 'active')
        .is('printed_at', null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    }
    return (
      memory.find((r) => r.receipt_id === receiptId && r.queue_status === 'active' && !r.printed_at) ?? null
    );
  }

  async listActive(): Promise<PrintRequestListItem[]> {
    return this.listByQueue('active');
  }

  async listArchived(): Promise<PrintRequestListItem[]> {
    return this.listByQueue('archived');
  }

  private async listByQueue(queueStatus: 'active' | 'archived'): Promise<PrintRequestListItem[]> {
    if (isSupabaseConfigured()) {
      let query = supabaseAdmin
        .from('print_requests')
        .select('*, orders(order_number, status), delivery_receipts(receipt_number, payer_name, amount)')
        .eq('queue_status', queueStatus)
        .order('created_at', { ascending: false });
      if (queueStatus === 'active') {
        query = query.is('printed_at', null);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapListRow(row as Record<string, unknown>));
    }
    return memory
      .filter((r) => r.queue_status === queueStatus && (queueStatus === 'archived' || !r.printed_at))
      .map((r) => ({
        ...r,
        order_number: '',
        order_status: '',
        receipt_number: '',
        payer_name: '',
        amount: 0,
      }));
  }

  async markPrinted(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('print_requests')
        .update({ printed_at: now, updated_at: now })
        .in('id', ids)
        .eq('queue_status', 'active')
        .is('printed_at', null)
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    }
    let count = 0;
    for (const id of ids) {
      const row = memory.find((r) => r.id === id && r.queue_status === 'active' && !r.printed_at);
      if (row) {
        row.printed_at = now;
        row.updated_at = now;
        count++;
      }
    }
    return count;
  }

  async archiveByOrderId(orderId: string): Promise<number> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('print_requests')
        .update({ queue_status: 'archived', updated_at: now })
        .eq('order_id', orderId)
        .eq('queue_status', 'active')
        .is('printed_at', null)
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    }
    let count = 0;
    for (const row of memory) {
      if (row.order_id === orderId && row.queue_status === 'active' && !row.printed_at) {
        row.queue_status = 'archived';
        row.updated_at = now;
        count++;
      }
    }
    return count;
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin.from('print_requests').delete().in('id', ids).select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    }
    let count = 0;
    for (const id of ids) {
      const idx = memory.findIndex((r) => r.id === id);
      if (idx >= 0) {
        memory.splice(idx, 1);
        count++;
      }
    }
    return count;
  }
}

export const printRequestRepository = new PrintRequestRepository();
