import type { DeliveryReceipt, DeliveryReceiptStatus } from '../types/receipt.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

const memoryReceipts: DeliveryReceipt[] = [];
const memorySequences = new Map<number, number>();

function mapRow(row: Record<string, unknown>): DeliveryReceipt {
  return {
    id: String(row.id),
    receipt_number: String(row.receipt_number),
    order_id: String(row.order_id),
    session_id: String(row.session_id),
    status: row.status as DeliveryReceiptStatus,
    amount: Number(row.amount),
    amount_extenso: String(row.amount_extenso),
    payer_name: String(row.payer_name),
    payer_document: row.payer_document ? String(row.payer_document) : null,
    payee_name: String(row.payee_name),
    payee_document: String(row.payee_document),
    reference_description: String(row.reference_description),
    issue_city: String(row.issue_city),
    issue_state: String(row.issue_state),
    issued_at: String(row.issued_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    rejected_at: row.rejected_at ? String(row.rejected_at) : null,
    accepted_by_user_id: row.accepted_by_user_id ? String(row.accepted_by_user_id) : null,
    acceptance_ip: row.acceptance_ip ? String(row.acceptance_ip) : null,
    acceptance_user_agent: row.acceptance_user_agent ? String(row.acceptance_user_agent) : null,
    terms_version: String(row.terms_version ?? '1'),
    scanned_by_role: row.scanned_by_role as 'admin' | 'driver',
    scanned_by_profile_id: row.scanned_by_profile_id ? String(row.scanned_by_profile_id) : null,
    scanned_by_driver_id: row.scanned_by_driver_id ? String(row.scanned_by_driver_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function nextReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  if (isSupabaseConfigured()) {
    const { data: existing } = await supabaseAdmin
      .from('receipt_sequences')
      .select('last_number')
      .eq('year', year)
      .maybeSingle();
    const next = (existing?.last_number ?? 0) + 1;
    await supabaseAdmin.from('receipt_sequences').upsert({ year, last_number: next }, { onConflict: 'year' });
    return `${year}-${String(next).padStart(6, '0')}`;
  }
  const next = (memorySequences.get(year) ?? 0) + 1;
  memorySequences.set(year, next);
  return `${year}-${String(next).padStart(6, '0')}`;
}

export class ReceiptRepository {
  async create(input: Omit<DeliveryReceipt, 'id' | 'receipt_number' | 'created_at' | 'updated_at' | 'accepted_at' | 'rejected_at' | 'accepted_by_user_id' | 'acceptance_ip' | 'acceptance_user_agent'> & { receipt_number?: string }): Promise<DeliveryReceipt> {
    const now = new Date().toISOString();
    const receipt_number = input.receipt_number ?? (await nextReceiptNumber());
    const row = {
      ...input,
      receipt_number,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin.from('delivery_receipts').insert(row).select().single();
      if (error) throw new Error(error.message);
      return mapRow(data);
    }

    const receipt: DeliveryReceipt = {
      id: crypto.randomUUID(),
      receipt_number,
      order_id: input.order_id,
      session_id: input.session_id,
      status: input.status,
      amount: input.amount,
      amount_extenso: input.amount_extenso,
      payer_name: input.payer_name,
      payer_document: input.payer_document,
      payee_name: input.payee_name,
      payee_document: input.payee_document,
      reference_description: input.reference_description,
      issue_city: input.issue_city,
      issue_state: input.issue_state,
      issued_at: input.issued_at,
      accepted_at: null,
      rejected_at: null,
      accepted_by_user_id: null,
      acceptance_ip: null,
      acceptance_user_agent: null,
      terms_version: input.terms_version,
      scanned_by_role: input.scanned_by_role,
      scanned_by_profile_id: input.scanned_by_profile_id,
      scanned_by_driver_id: input.scanned_by_driver_id,
      created_at: now,
      updated_at: now,
    };
    memoryReceipts.unshift(receipt);
    return receipt;
  }

  async findById(id: string): Promise<DeliveryReceipt | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin.from('delivery_receipts').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    }
    return memoryReceipts.find((r) => r.id === id) ?? null;
  }

  async findBySessionId(sessionId: string): Promise<DeliveryReceipt | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin.from('delivery_receipts').select('*').eq('session_id', sessionId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    }
    return memoryReceipts.find((r) => r.session_id === sessionId) ?? null;
  }

  async findPendingByOrderId(orderId: string): Promise<DeliveryReceipt | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('delivery_receipts')
        .select('*')
        .eq('order_id', orderId)
        .eq('status', 'pending_acceptance')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    }
    return memoryReceipts.find((r) => r.order_id === orderId && r.status === 'pending_acceptance') ?? null;
  }

  async findLatestByOrderId(orderId: string): Promise<DeliveryReceipt | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('delivery_receipts')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    }
    return memoryReceipts.find((r) => r.order_id === orderId) ?? null;
  }

  async update(id: string, patch: Partial<DeliveryReceipt>): Promise<DeliveryReceipt | null> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('delivery_receipts')
        .update({ ...patch, updated_at: now })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data ? mapRow(data) : null;
    }
    const idx = memoryReceipts.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    memoryReceipts[idx] = { ...memoryReceipts[idx], ...patch, updated_at: now };
    return memoryReceipts[idx];
  }

  async list(options: { page?: number; limit?: number } = {}): Promise<{ receipts: DeliveryReceipt[]; total: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const from = (page - 1) * limit;
    if (isSupabaseConfigured()) {
      const { data, error, count } = await supabaseAdmin
        .from('delivery_receipts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);
      if (error) throw new Error(error.message);
      return { receipts: (data ?? []).map(mapRow), total: count ?? 0 };
    }
    const total = memoryReceipts.length;
    return { receipts: memoryReceipts.slice(from, from + limit), total };
  }
}

export const receiptRepository = new ReceiptRepository();
