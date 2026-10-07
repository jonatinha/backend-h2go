import { FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from '../services/orderService.js';
import {
  createOrderSchema,
  orderIdParamSchema,
  listOrdersQuerySchema,
  updateOrderStatusSchema,
} from '../schemas/order.schema.js';
import { formatSuccess, formatPaginated, formatError } from '../utils/response.js';

export class OrderController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }

    const body = createOrderSchema.parse(request.body);
    const idempotencyKey = (request.headers['idempotency-key'] as string) || undefined;

    const order = await orderService.createOrder(
      request.user.id,
      {
        address_id: body.address_id,
        payment_method: body.payment_method,
        notes: body.notes,
      },
      idempotencyKey
    );

    return reply.status(201).send(formatSuccess(order));
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }

    const query = listOrdersQuerySchema.parse(request.query);
    const { orders, total } = await orderService.listUserOrders(request.user.id, {
      page: query.page,
      limit: query.limit,
      status: query.status,
    });

    return reply.send(formatPaginated(orders, total, query.page, query.limit));
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }

    const { id } = orderIdParamSchema.parse(request.params);
    // Enforce security: users can only view their own order unless they are an admin
    const userIdFilter = request.user.role === 'admin' ? undefined : request.user.id;
    const order = await orderService.getOrderById(id, userIdFilter);

    if (!order) {
      return reply.status(404).send(
        formatError('ORDER_NOT_FOUND', 'Pedido não encontrado.', request.requestId)
      );
    }

    return reply.send(formatSuccess(order));
  }

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }

    const { id } = orderIdParamSchema.parse(request.params);
    const cancelled = await orderService.cancelOrder(id, request.user.id);
    return reply.send(formatSuccess(cancelled));
  }

  // Admin Order Status Update
  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = orderIdParamSchema.parse(request.params);
    const body = updateOrderStatusSchema.parse(request.body);
    const updated = await orderService.updateOrderStatus(id, body.status);
    return reply.send(formatSuccess(updated));
  }
}

export const orderController = new OrderController();
