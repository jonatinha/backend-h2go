import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/paymentService.js';
import { orderService } from '../services/orderService.js';
import {
  createPaymentSchema,
  paymentIdParamSchema,
} from '../schemas/payment.schema.js';
import { formatSuccess, formatError } from '../utils/response.js';

export class PaymentController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }

    const body = createPaymentSchema.parse(request.body);
    const order = await orderService.getOrderById(body.order_id, request.user.id);

    if (!order) {
      return reply.status(404).send(
        formatError('ORDER_NOT_FOUND', 'Pedido associado não encontrado.', request.requestId)
      );
    }

    const result = await paymentService.createPayment({
      orderId: order.id,
      amount: order.total,
      currency: order.currency,
      method: body.method,
      customer: {
        email: request.user.email,
        name: request.user.full_name || undefined,
      },
    });

    return reply.status(201).send(formatSuccess(result));
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = paymentIdParamSchema.parse(request.params);
    const payment = await paymentService.getPaymentById(id);

    if (!payment) {
      return reply.status(404).send(
        formatError('PAYMENT_NOT_FOUND', 'Registro de pagamento não encontrado.', request.requestId)
      );
    }

    // Customer can only view payment if they own the order
    if (request.user && request.user.role !== 'admin') {
      const order = await orderService.getOrderById(payment.order_id, request.user.id);
      if (!order) {
        return reply.status(403).send(
          formatError('FORBIDDEN', 'Você não tem permissão para visualizar este pagamento.', request.requestId)
        );
      }
    }

    return reply.send(formatSuccess(payment));
  }

  async webhook(request: FastifyRequest, reply: FastifyReply) {
    const headers = request.headers as Record<string, string>;
    const result = await paymentService.handleWebhook(request.body, headers);
    return reply.send(formatSuccess(result));
  }
}

export const paymentController = new PaymentController();
