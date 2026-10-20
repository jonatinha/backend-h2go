import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/repositories/paymentRepository.js', () => ({
  paymentRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    createEvent: vi.fn(),
  },
}));

vi.mock('../../src/repositories/orderRepository.js', () => ({
  orderRepository: {
    updateStatus: vi.fn(),
  },
}));

import { PendingPaymentProvider } from '../../src/services/paymentService.js';
import { paymentRepository } from '../../src/repositories/paymentRepository.js';
import { orderRepository } from '../../src/repositories/orderRepository.js';
import type { Payment } from '../../src/types/index.js';

describe('PendingPaymentProvider.handleWebhook', () => {
  const provider = new PendingPaymentProvider();

  const payment: Payment = {
    id: 'payment-test-unique',
    order_id: 'order-test-unique',
    provider: 'mock-pending',
    external_id: 'external-test',
    method: 'pix',
    status: 'pending',
    amount: 25,
    currency: 'BRL',
    paid_at: null,
    expires_at: null,
    metadata: {},
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(paymentRepository.findById).mockResolvedValue({ ...payment });
    vi.mocked(paymentRepository.updateStatus).mockResolvedValue({
      ...payment,
      status: 'approved',
      paid_at: '2026-01-01T10:00:00.000Z',
    });
    vi.mocked(paymentRepository.createEvent).mockResolvedValue(undefined);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(null);
  });

  it('rejeita payload nulo, não objeto ou array', async () => {
    for (const payload of [null, 'texto', 123, [], undefined]) {
      const result = await provider.handleWebhook(payload, {});
      expect(result.processed).toBe(false);
    }

    expect(paymentRepository.findById).not.toHaveBeenCalled();
    expect(paymentRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejeita identificador ausente ou status ausente/inválido', async () => {
    const payloads = [
      { status: 'approved' },
      { id: payment.id },
      { id: payment.id, status: 'unknown' },
      { id: payment.id, status: 123 },
      { id: '', status: 'approved' },
    ];

    for (const payload of payloads) {
      const result = await provider.handleWebhook(payload, {});
      expect(result.processed).toBe(false);
    }

    expect(paymentRepository.findById).not.toHaveBeenCalled();
    expect(paymentRepository.updateStatus).not.toHaveBeenCalled();
    expect(paymentRepository.createEvent).not.toHaveBeenCalled();
  });

  it('aprova pagamento, define paid_at e confirma o pedido', async () => {
    const result = await provider.handleWebhook(
      { payment_id: payment.id, status: 'approved' },
      {},
    );

    expect(result).toEqual({
      processed: true,
      orderId: payment.order_id,
      status: 'approved',
    });
    expect(paymentRepository.updateStatus).toHaveBeenCalledWith(
      payment.id,
      'approved',
      expect.any(String),
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(
      payment.order_id,
      'confirmed',
    );
    expect(paymentRepository.createEvent).toHaveBeenCalledOnce();
  });

  it('preserva paid_at ao rejeitar pagamento e cancela o pedido', async () => {
    const paidAt = '2026-02-03T12:30:00.000Z';
    vi.mocked(paymentRepository.findById).mockResolvedValue({
      ...payment,
      paid_at: paidAt,
    });

    await provider.handleWebhook(
      { id: payment.id, status: 'rejected' },
      {},
    );

    expect(paymentRepository.updateStatus).toHaveBeenCalledWith(
      payment.id,
      'rejected',
      undefined,
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(
      payment.order_id,
      'cancelled',
    );
  });

  it('não altera o pedido para status processing', async () => {
    await provider.handleWebhook(
      { id: payment.id, status: 'processing' },
      {},
    );

    expect(paymentRepository.updateStatus).toHaveBeenCalledWith(
      payment.id,
      'processing',
      undefined,
    );
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('não processa pagamento inexistente', async () => {
    vi.mocked(paymentRepository.findById).mockResolvedValue(null);

    const result = await provider.handleWebhook(
      { id: 'payment-missing', status: 'approved' },
      {},
    );

    expect(result.processed).toBe(false);
    expect(paymentRepository.updateStatus).not.toHaveBeenCalled();
    expect(paymentRepository.createEvent).not.toHaveBeenCalled();
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });
});
