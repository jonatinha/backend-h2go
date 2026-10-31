import { FastifyRequest, FastifyReply } from 'fastify';
import { adminService } from '../services/adminService.js';
import { userRepository } from '../repositories/userRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { logsRepository } from '../repositories/logsRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { healthService } from '../services/healthService.js';
import { orderService } from '../services/orderService.js';
import { addressRepository } from '../repositories/addressRepository.js';
import {
  orderIdParamSchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
  scanOrderSchema,
  adminCreateOrderSchema,
} from '../schemas/order.schema.js';
import { createAddressSchema } from '../schemas/address.schema.js';
import { formatSuccess, formatPaginated, formatError } from '../utils/response.js';
import { withoutDeliveryQrToken } from '../utils/deliveryQr.js';
import { redeemDeliveryQr } from '../services/deliveryQrService.js';

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
      fulfillment_type: query.fulfillment_type,
    });
    return reply.send(
      formatPaginated(orders.map(withoutDeliveryQrToken), total, query.page, query.limit)
    );
  }

  async getOrderById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = orderIdParamSchema.parse(request.params);
    const order = await orderRepository.findById(id);

    if (!order) {
      return reply.status(404).send(
        formatError('ORDER_NOT_FOUND', 'Pedido não encontrado.', request.requestId)
      );
    }

    return reply.send(formatSuccess(withoutDeliveryQrToken(order)));
  }

  async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = orderIdParamSchema.parse(request.params);
    const body = updateOrderStatusSchema.parse(request.body);
    const updated = await orderService.updateOrderStatus(id, body.status);
    return reply.send(formatSuccess(withoutDeliveryQrToken(updated)));
  }

  async createOrder(request: FastifyRequest, reply: FastifyReply) {
    const body = adminCreateOrderSchema.parse(request.body);
    if (!request.user) {
      return reply.status(401).send(formatError('UNAUTHORIZED', 'Não autenticado', request.requestId));
    }

    try {
      const order = await orderService.createAdminOrder(request.user.id, body);
      return reply.status(201).send(formatSuccess(withoutDeliveryQrToken(order)));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível criar o pedido.';
      const code = message.split(':')[0] || 'ORDER_CREATE_FAILED';
      const status =
        code === 'USER_NOT_FOUND' || code === 'ADDRESS_NOT_FOUND' || code === 'PROD_NOT_FOUND'
          ? 404
          : 400;
      return reply.status(status).send(
        formatError(code, message.replace(/^[^:]+:\s*/, ''), request.requestId)
      );
    }
  }

  async listUserAddresses(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return reply.status(400).send(formatError('INVALID_USER', 'ID de usuário inválido.', request.requestId));
    }
    const addresses = await addressRepository.findByUserId(userId);
    return reply.send(formatSuccess(addresses));
  }

  async createUserAddress(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return reply.status(400).send(formatError('INVALID_USER', 'ID de usuário inválido.', request.requestId));
    }
    const owner = await userRepository.findById(userId);
    if (!owner) {
      return reply.status(404).send(formatError('USER_NOT_FOUND', 'Usuário não encontrado.', request.requestId));
    }

    const body = createAddressSchema.parse(request.body);
    const created = await addressRepository.create({
      user_id: userId,
      ...body,
      complement: body.complement ?? null,
      reference: body.reference ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      is_default: body.is_default ?? false,
    });
    return reply.status(201).send(formatSuccess(created));
  }

  async scanOrder(request: FastifyRequest, reply: FastifyReply) {
    const body = scanOrderSchema.parse(request.body);
    try {
      const result = await redeemDeliveryQr(body.payload, { role: 'admin' });
      return reply.send(formatSuccess(result));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível dar baixa neste pedido.';
      const code = message.split(':')[0] || 'SCAN_FAILED';
      const status = code === 'ORDER_CANCELLED' ? 409 : 400;
      return reply.status(status).send(
        formatError(code, message.replace(/^[^:]+:\s*/, ''), request.requestId)
      );
    }
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

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    if (!body?.name || body.price === undefined) {
      return reply.status(400).send(
        formatError('INVALID_PRODUCT', 'Nome e preço são obrigatórios.', request.requestId)
      );
    }
    const slug = body.slug || body.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const sku = body.sku || 'H2GO-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const product = await productRepository.create({
      category_id: body.category_id || null,
      name: body.name,
      slug,
      sku,
      description: body.description || null,
      price: Number(body.price),
      unit: body.unit || 'un',
      minimum_quantity: Number(body.minimum_quantity) || 1,
      maximum_quantity: body.maximum_quantity ? Number(body.maximum_quantity) : null,
      quantity_step: Number(body.quantity_step) || 1,
      package_size: body.package_size ? Number(body.package_size) : null,
      package_label: body.package_label || null,
      image_url: body.image_url || null,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      stock_control_enabled: body.stock_control_enabled !== undefined ? Boolean(body.stock_control_enabled) : false,
      stock_quantity: Number(body.stock_quantity) || 0,
    });
    return reply.status(201).send(formatSuccess(product));
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const updated = await productRepository.update(id, {
      ...body,
      price: body.price !== undefined ? Number(body.price) : undefined,
      stock_quantity: body.stock_quantity !== undefined ? Number(body.stock_quantity) : undefined,
    });
    if (!updated) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Produto não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess(updated));
  }

  async deleteProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const success = await productRepository.delete(id);
    if (!success) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Produto não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess({ message: 'Produto excluído com sucesso.' }));
  }

  async updateOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    delete body.delivery_qr_token;
    const updated = await orderRepository.updateOrder(id, body as any);
    if (!updated) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Pedido não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess(withoutDeliveryQrToken(updated)));
  }

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    if (!body?.email) {
      return reply.status(400).send(formatError('INVALID_USER', 'E-mail é obrigatório.', request.requestId));
    }
    const user = await userRepository.createProfile({
      id: crypto.randomUUID(),
      email: body.email,
      full_name: body.full_name || null,
      phone: body.phone || null,
      role: body.role || 'customer',
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    });
    return reply.status(201).send(formatSuccess(user));
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const updated = await userRepository.updateProfile(id, body);
    if (!updated) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Usuário não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess(updated));
  }
}

export const adminController = new AdminController();
