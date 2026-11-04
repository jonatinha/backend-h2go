import type { Order } from '../types/index.js';
import { productRepository } from '../repositories/productRepository.js';
import { supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';

export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  balance_after: number;
  note: string | null;
  order_id: string | null;
  created_at: string;
  product_name?: string;
}

type MemoryMovement = StockMovement;

const memoryMovements: MemoryMovement[] = [];

function lineQuantities(order: Order): Map<string, number> {
  const lines = new Map<string, number>();
  for (const item of order.items || []) {
    if (!item.product_id) continue;
    lines.set(item.product_id, (lines.get(item.product_id) || 0) + item.quantity);
  }
  return lines;
}

export class StockService {
  async listMovements(limit = 80): Promise<StockMovement[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('stock_movements')
        .select('*, product:products(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({
        id: row.id,
        product_id: row.product_id,
        movement_type: row.movement_type,
        quantity: Number(row.quantity),
        balance_after: Number(row.balance_after),
        note: row.note,
        order_id: row.order_id,
        created_at: row.created_at,
        product_name: row.product?.name ?? undefined,
      }));
    }
    return [...memoryMovements].reverse().slice(0, limit);
  }

  async move(input: {
    productId: string;
    type: StockMovementType;
    quantity: number;
    note?: string | null;
    orderId?: string | null;
  }): Promise<StockMovement> {
    const quantity = Math.floor(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('INVALID_QUANTITY: Informe uma quantidade maior que zero.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const product = await productRepository.findById(input.productId);
      if (!product) throw new Error('PRODUCT_NOT_FOUND: Produto não encontrado.');

      const current = Math.max(0, Number(product.stock_quantity) || 0);
      let next = current;
      let storedQuantity = quantity;

      if (input.type === 'in') next = current + quantity;
      else if (input.type === 'out') {
        if (current < quantity) {
          throw new Error(`INSUFFICIENT_STOCK: ${product.name} tem ${current} em estoque.`);
        }
        next = current - quantity;
      } else {
        next = quantity;
        storedQuantity = Math.abs(next - current) || 1;
        if (next === current) {
          return {
            id: 'noop',
            product_id: product.id,
            movement_type: 'adjustment',
            quantity: 0,
            balance_after: current,
            note: input.note ?? null,
            order_id: input.orderId ?? null,
            created_at: new Date().toISOString(),
            product_name: product.name,
          };
        }
      }

      const updated = await productRepository.update(product.id, {
        stock_quantity: next,
        stock_control_enabled: true,
      });
      if (!updated) throw new Error('STOCK_UPDATE_FAILED: Não foi possível atualizar o estoque.');

      const movement: StockMovement = {
        id: crypto.randomUUID(),
        product_id: product.id,
        movement_type: input.type,
        quantity: storedQuantity,
        balance_after: next,
        note: input.note?.trim() || null,
        order_id: input.orderId ?? null,
        created_at: new Date().toISOString(),
        product_name: product.name,
      };

      if (isSupabaseConfigured()) {
        const { error } = await supabaseAdmin.from('stock_movements').insert({
          id: movement.id,
          product_id: movement.product_id,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          balance_after: movement.balance_after,
          note: movement.note,
          order_id: movement.order_id,
        });
        if (!error) return movement;
        if (attempt === 2) throw new Error(error.message);
        continue;
      }

      memoryMovements.push(movement);
      return movement;
    }

    throw new Error('STOCK_UPDATE_FAILED: Não foi possível atualizar o estoque.');
  }

  async applyOrder(order: Order, direction: 'out' | 'in'): Promise<void> {
    const lines = lineQuantities(order);
    if (!lines.size) return;

    const movements = await this.movementsForOrder(order.id);
    const outs = movements.filter((row) => row.movement_type === 'out').length;
    const ins = movements.filter((row) => row.movement_type === 'in').length;
    if (direction === 'out' && outs > ins) return;
    if (direction === 'in' && ins >= outs) return;

    const applied: Array<{ productId: string; quantity: number }> = [];
    try {
      for (const [productId, quantity] of lines) {
        await this.move({
          productId,
          type: direction === 'out' ? 'out' : 'in',
          quantity,
          orderId: order.id,
          note:
            direction === 'out'
              ? `Saída do pedido ${order.id.slice(0, 8)}`
              : `Entrada de estorno do pedido ${order.id.slice(0, 8)}`,
        });
        applied.push({ productId, quantity });
      }
    } catch (error) {
      for (const row of applied.reverse()) {
        await this.move({
          productId: row.productId,
          type: direction === 'out' ? 'in' : 'out',
          quantity: row.quantity,
          orderId: order.id,
          note: `Compensação do pedido ${order.id.slice(0, 8)}`,
        }).catch(() => undefined);
      }
      throw error;
    }
  }

  private async movementsForOrder(orderId: string): Promise<StockMovement[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('stock_movements')
        .select('*')
        .eq('order_id', orderId);
      if (error) throw new Error(error.message);
      return (data || []) as StockMovement[];
    }
    return memoryMovements.filter((row) => row.order_id === orderId);
  }
}

export const stockService = new StockService();
