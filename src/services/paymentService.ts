import { Payment, PaymentMethod, PaymentStatus } from '../types/index.js';
import { paymentRepository } from '../repositories/paymentRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customer?: { name?: string; email?: string; phone?: string };
}

export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  provider: string;
  externalId?: string | null;
  qrCode?: string | null;
  paymentUrl?: string | null;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPayment(paymentId: string): Promise<Payment | null>;
  refundPayment(paymentId: string): Promise<{ success: boolean; refundId?: string }>;
  handleWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<{ processed: boolean; orderId?: string; status?: PaymentStatus }>;
}

export class PendingPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const payment = await paymentRepository.create({
      order_id: input.orderId,
      provider: 'mock-pending',
      external_id: `ext_${Date.now()}`,
      method: input.method,
      status: 'pending',
      amount: input.amount,
      currency: input.currency || 'BRL',
      paid_at: null,
      expires_at: null,
      metadata: {},
    });

    return {
      paymentId: payment.id,
      status: payment.status,
      provider: payment.provider,
      externalId: payment.external_id,
    };
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    return paymentRepository.findById(paymentId);
  }

  async refundPayment(paymentId: string): Promise<{ success: boolean; refundId?: string }> {
    const updated = await paymentRepository.updateStatus(paymentId, 'refunded');
    return { success: Boolean(updated), refundId: `ref_${Date.now()}` };
  }

  async handleWebhook(
    payload: any,
    _headers: Record<string, string>
  ): Promise<{ processed: boolean; orderId?: string; status?: PaymentStatus }> {
    const paymentId = payload?.payment_id || payload?.id;
    const newStatus: PaymentStatus = payload?.status || 'approved';

    if (paymentId) {
      const payment = await paymentRepository.findById(paymentId);
      if (payment) {
        await paymentRepository.updateStatus(paymentId, newStatus, new Date().toISOString());
        await paymentRepository.createEvent(paymentId, 'webhook_received', payload);

        if (newStatus === 'approved') {
          await orderRepository.updateStatus(payment.order_id, 'confirmed');
        } else if (newStatus === 'rejected' || newStatus === 'cancelled') {
          await orderRepository.updateStatus(payment.order_id, 'cancelled');
        }

        return { processed: true, orderId: payment.order_id, status: newStatus };
      }
    }

    return { processed: false };
  }
}

export class PaymentService {
  private provider: PaymentProvider;

  constructor(provider?: PaymentProvider) {
    this.provider = provider || new PendingPaymentProvider();
  }

  setProvider(provider: PaymentProvider) {
    this.provider = provider;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    return this.provider.createPayment(input);
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return this.provider.getPayment(paymentId);
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>) {
    return this.provider.handleWebhook(payload, headers);
  }
}

export const paymentService = new PaymentService();
