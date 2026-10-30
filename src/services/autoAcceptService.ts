import { settingsRepository } from '../repositories/settingsRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import type { Order } from '../types/index.js';

export class AutoAcceptService {
  async isEnabled(): Promise<boolean> {
    const value = await settingsRepository.getByKey('AUTO_ACCEPT_ORDERS');
    return value === 'true' || value === '1';
  }

  /** Avança pending → confirmed quando a opção está ligada. */
  async applyIfEnabled(order: Order): Promise<Order> {
    if (order.status !== 'pending') return order;
    if (!(await this.isEnabled())) return order;

    const updated = await orderRepository.updateStatus(order.id, 'confirmed');
    return updated ?? order;
  }
}

export const autoAcceptService = new AutoAcceptService();
