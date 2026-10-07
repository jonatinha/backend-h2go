import { FastifyRequest, FastifyReply } from 'fastify';
import { adminService } from '../services/adminService.js';
import { userRepository } from '../repositories/userRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { logsRepository } from '../repositories/logsRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { healthService } from '../services/healthService.js';
import { orderService } from '../services/orderService.js';
import {
  orderIdParamSchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
} from '../schemas/order.schema.js';
import { formatSuccess, formatPaginated, formatError } from '../utils/response.js';

export class AdminController {
  async getDashboard(_request: FastifyRequest, reply: FastifyReply) {
    const data = await adminService.getDashboard();
    return reply.send(formatSuccess(data));
  }

  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { users, total } = await userRepository.findAll({ page, limit, role: query.role });
    return reply.send(formatPaginated(users, total, page, limit));
  }

  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    const query = listOrdersQuerySchema.parse(request.query);
    const { orders, total } = await orderRepository.findAll({
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
    return reply.send(formatPaginated(orders, total, query.page, query.limit));
  }

  async getOrderById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = orderIdParamSchema.parse(request.params);
    const order = await orderRepository.findById(id);

    if (!order) {
      return reply.status(404).send(
        formatError('ORDER_NOT_FOUND', 'Pedido não encontrado.', request.requestId)
      );
    }

    return reply.send(formatSuccess(order));
  }

  async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = orderIdParamSchema.parse(request.params);
    const body = updateOrderStatusSchema.parse(request.body);
    const updated = await orderService.updateOrderStatus(id, body.status);
    return reply.send(formatSuccess(updated));
  }

  async listProducts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const { products, total } = await productRepository.findAll({
      page,
      limit,
      search: query.search,
      isActive: query.is_active !== undefined ? query.is_active === 'true' : undefined,
    });
    return reply.send(formatPaginated(products, total, page, limit));
  }

  async listLogs(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const hasError = query.hasError === 'true';
    const method = query.method;
    const statusGroup = query.statusGroup;
    const search = query.search;

    const { logs, total } = await logsRepository.findLogs({
      page,
      limit,
      hasError,
      method,
      statusGroup,
      search,
    });

    return reply.send(formatPaginated(logs, total, page, limit));
  }

  async getSystemSettings(_request: FastifyRequest, reply: FastifyReply) {
    const settings = await settingsRepository.getAll();
    return reply.send(formatSuccess(settings));
  }

  async updateSystemSetting(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { key: string; value: string; description?: string };
    if (!body.key || body.value === undefined) {
      return reply.status(400).send(
        formatError('INVALID_SETTING', 'Chave e valor são obrigatórios.', request.requestId)
      );
    }
    const setting = await settingsRepository.setKey(body.key, String(body.value), body.description);
    return reply.send(formatSuccess(setting));
  }

  async getHealth(_request: FastifyRequest, reply: FastifyReply) {
    const health = healthService.getHealth();
    return reply.send(formatSuccess(health));
  }
}

export const adminController = new AdminController();
