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
import { supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { stockService, type StockMovementType } from '../services/stockService.js';
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
import type { Order, UserProfile } from '../types/index.js';

function customerDisplayName(order: Order, profile?: UserProfile | null): string {
  const fromProfile = profile?.full_name?.trim();
  const fromPickup = order.pickup_contact_name?.trim();
  const rawAddressName = order.address?.name?.trim() ?? '';
  const fromAddress = /^(principal|endere[cç]o de entrega)$/i.test(rawAddressName)
    ? ''
    : rawAddressName;
  const fromEmail = profile?.email?.trim();
  return fromProfile || fromPickup || fromAddress || fromEmail || 'Cliente';
}

async function withCustomerDetails<T extends Order>(orders: T[]) {
  let profiles: UserProfile[] = [];
  try {
    profiles = await userRepository.findByIds(orders.map((order) => order.user_id));
  } catch (err) {
    console.warn('Não foi possível carregar os nomes dos clientes:', err);
  }
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return orders.map((order) => {
    const profile = byId.get(order.user_id);
    const customerName = customerDisplayName(order, profile);
    return {
      ...order,
      customer_name: customerName,
      customer: {
        name: customerName,
        email: profile?.email ?? null,
        phone: profile?.phone ?? order.address?.phone ?? null,
      },
    };
  });
}

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
      archived: query.archived === 'true',
    });
    const withCustomers = await withCustomerDetails(orders);
    return reply.send(
      formatPaginated(withCustomers.map(withoutDeliveryQrToken), total, query.page, query.limit)
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

    const [withCustomer] = await withCustomerDetails([order]);
    return reply.send(formatSuccess(withoutDeliveryQrToken(withCustomer)));
  }

  async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = orderIdParamSchema.parse(request.params);
    const body = updateOrderStatusSchema.parse(request.body);
    const updated = await orderService.updateOrderStatus(id, body.status);
    const [withCustomer] = await withCustomerDetails([updated]);
    return reply.send(formatSuccess(withoutDeliveryQrToken(withCustomer)));
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

  async archiveOrder(request: FastifyRequest, reply: FastifyReply) {
    return this.changeOrderArchive(request, reply, true);
  }

  async unarchiveOrder(request: FastifyRequest, reply: FastifyReply) {
    return this.changeOrderArchive(request, reply, false);
  }

  private async changeOrderArchive(request: FastifyRequest, reply: FastifyReply, archived: boolean) {
    const { id } = request.params as { id: string };
    try {
      const updated = await orderRepository.setArchived(id, archived);
      if (!updated) {
        return reply.status(404).send(formatError('NOT_FOUND', 'Pedido não encontrado.', request.requestId));
      }
      const [withCustomer] = await withCustomerDetails([updated]);
      return reply.send(formatSuccess(withoutDeliveryQrToken(withCustomer)));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível arquivar o pedido.';
      return reply.status(400).send(formatError('ORDER_ARCHIVE_FAILED', message, request.requestId));
    }
  }

  async deleteOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const existing = await orderRepository.findById(id);
      if (!existing) {
        return reply.status(404).send(formatError('NOT_FOUND', 'Pedido não encontrado.', request.requestId));
      }
      if (existing.status !== 'cancelled') {
        await stockService.applyOrder(existing, 'in');
      }
      const removed = await orderRepository.delete(id);
      if (!removed) {
        return reply.status(404).send(formatError('NOT_FOUND', 'Pedido não encontrado.', request.requestId));
      }
      return reply.send(formatSuccess({ message: 'Pedido excluído.' }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível excluir o pedido.';
      return reply.status(400).send(formatError('ORDER_DELETE_FAILED', message, request.requestId));
    }
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
    const body = request.body as {
      full_name?: string;
      phone?: string;
      email?: string;
      role?: string;
      is_active?: boolean;
      password?: string;
    };
    const allowedRoles = new Set(['customer', 'admin', 'delivery']);
    if (body.role && !allowedRoles.has(body.role)) {
      return reply.status(400).send(formatError('INVALID_ROLE', 'Perfil inválido.', request.requestId));
    }
    if (body.password && body.password.length < 6) {
      return reply.status(400).send(
        formatError('INVALID_PASSWORD', 'A senha precisa ter pelo menos 6 caracteres.', request.requestId)
      );
    }

    const email = body.email?.trim().toLowerCase();
    if (email) {
      const taken = await userRepository.findByEmail(email);
      if (taken && taken.id !== id) {
        return reply.status(409).send(formatError('EMAIL_IN_USE', 'Este e-mail já está em uso.', request.requestId));
      }
    }

    const updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'email' | 'role' | 'is_active'>> = {};
    if (body.full_name !== undefined) updates.full_name = body.full_name.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone.trim() || null;
    if (email) updates.email = email;
    if (body.role) updates.role = body.role as UserProfile['role'];
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    const updated = await userRepository.updateProfile(id, updates);
    if (!updated) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Usuário não encontrado.', request.requestId));
    }

    if ((email || body.password) && isSupabaseConfigured()) {
      const authPatch: { email?: string; password?: string; email_confirm?: boolean } = {};
      if (email) {
        authPatch.email = email;
        authPatch.email_confirm = true;
      }
      if (body.password) authPatch.password = body.password;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, authPatch);
      if (error && body.password) {
        return reply.status(400).send(
          formatError('AUTH_UPDATE_FAILED', 'Não foi possível atualizar o login deste usuário.', request.requestId)
        );
      }
    }

    return reply.send(formatSuccess(updated));
  }

  async listStock(request: FastifyRequest, reply: FastifyReply) {
    const [productsResult, movements] = await Promise.all([
      productRepository.findAll({ page: 1, limit: 100 }),
      stockService.listMovements(100),
    ]);
    return reply.send(formatSuccess({
      products: productsResult.products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock_quantity: product.stock_quantity,
        stock_control_enabled: product.stock_control_enabled,
        is_active: product.is_active,
      })),
      movements,
    }));
  }

  async createStockMovement(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as {
      product_id?: string;
      type?: StockMovementType;
      quantity?: number;
      note?: string;
    };
    if (!body.product_id || !body.type || !['in', 'out', 'adjustment'].includes(body.type)) {
      return reply.status(400).send(
        formatError('INVALID_STOCK', 'Informe o produto, o tipo e a quantidade.', request.requestId)
      );
    }
    try {
      const movement = await stockService.move({
        productId: body.product_id,
        type: body.type,
        quantity: Number(body.quantity),
        note: body.note,
      });
      return reply.status(201).send(formatSuccess(movement));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível lançar o estoque.';
      const code = message.split(':')[0] || 'STOCK_FAILED';
      const status = code === 'INSUFFICIENT_STOCK' || code === 'PRODUCT_NOT_FOUND' ? 409 : 400;
      return reply.status(status).send(
        formatError(code, message.replace(/^[^:]+:\s*/, ''), request.requestId)
      );
    }
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    if (request.user?.id === id) {
      return reply.status(400).send(
        formatError('CANNOT_DELETE_SELF', 'Você não pode apagar a própria conta.', request.requestId)
      );
    }

    try {
      const result = await userRepository.deleteProfile(id);
      if (result === 'not_found') {
        return reply.status(404).send(formatError('NOT_FOUND', 'Usuário não encontrado.', request.requestId));
      }
      if (result === 'has_orders') {
        return reply.status(409).send(
          formatError(
            'USER_HAS_ORDERS',
            'Este usuário ainda tem pedidos. Apague esses pedidos antes de excluir a conta.',
            request.requestId
          )
        );
      }
      return reply.send(formatSuccess({ message: 'Usuário excluído.' }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível excluir o usuário.';
      return reply.status(400).send(formatError('USER_DELETE_FAILED', message, request.requestId));
    }
  }
}

export const adminController = new AdminController();
