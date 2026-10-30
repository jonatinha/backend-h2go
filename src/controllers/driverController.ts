import type { FastifyReply, FastifyRequest } from 'fastify';
import { formatError, formatPaginated, formatSuccess } from '../utils/response.js';
import { deliveryRunService } from '../services/deliveryRunService.js';
import {
  deliveryDriverRepository,
  deliveryRegionRepository,
} from '../repositories/deliveryRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { updateRunStatusSchema } from '../schemas/delivery.schema.js';
import { scanOrderSchema } from '../schemas/order.schema.js';
import { redeemDeliveryQr } from '../services/deliveryQrService.js';
import { authService } from '../services/authService.js';

function requireDriverContext(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.user?.driver_id) {
    reply.status(403).send(formatError('FORBIDDEN', 'Perfil de entregador não encontrado.', request.requestId));
    return null;
  }
  return request.user.driver_id;
}

export class DriverController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { email?: string; password?: string };
    if (!body?.email || !body?.password) {
      return reply.status(400).send(formatError('INVALID_BODY', 'E-mail e senha são obrigatórios.', request.requestId));
    }

    try {
      const result = await authService.login(body.email, body.password);
      if (result.user.role !== 'delivery') {
        await authService.logout(result.session.access_token);
        return reply.status(403).send(
          formatError('FORBIDDEN', 'Esta conta não é de entregador.', request.requestId)
        );
      }

      const driver = await deliveryDriverRepository.findByProfileId(result.user.id);
      if (!driver || !driver.is_active) {
        await authService.logout(result.session.access_token);
        return reply.status(403).send(
          formatError('DRIVER_INACTIVE', 'Conta de entregador inativa ou não configurada.', request.requestId)
        );
      }

      return reply.send(
        formatSuccess({
          user: result.user,
          driver,
          session: result.session,
        })
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha no login.';
      return reply.status(401).send(formatError('AUTH_INVALID', message.replace(/^AUTH_[^:]+:\s*/, ''), request.requestId));
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;

    const driver = await deliveryDriverRepository.findById(driverId);
    const profile = request.user ? await userRepository.findById(request.user.id) : null;
    return reply.send(formatSuccess({ driver, profile }));
  }

  async listAvailable(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;

    try {
      const runs = await deliveryRunService.listAvailable(driverId);
      return reply.send(formatSuccess(runs));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao listar corridas.';
      return reply.status(400).send(formatError('DISPATCH_ERROR', message, request.requestId));
    }
  }

  async accept(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;
    const { orderId } = request.params as { orderId: string };

    try {
      const run = await deliveryRunService.acceptRun(driverId, orderId);
      return reply.send(formatSuccess(run));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível aceitar.';
      const code = message.startsWith('ORDER_') ? message.split(':')[0] : 'ACCEPT_FAILED';
      return reply.status(409).send(formatError(code, message.replace(/^[^:]+:\s*/, ''), request.requestId));
    }
  }

  async listActive(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;
    const runs = await deliveryRunService.listActive(driverId);
    return reply.send(formatSuccess(runs));
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;
    const { orderId } = request.params as { orderId: string };
    const body = updateRunStatusSchema.parse(request.body);

    try {
      await deliveryRunService.updateAssignmentStatus(driverId, orderId, body.status);
      return reply.send(formatSuccess({ message: 'Status atualizado.' }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao atualizar status.';
      return reply.status(400).send(formatError('STATUS_ERROR', message, request.requestId));
    }
  }

  async scanOrder(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;
    const body = scanOrderSchema.parse(request.body);

    try {
      const result = await redeemDeliveryQr(body.payload, { role: 'driver', driverId });
      return reply.send(formatSuccess(result));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível dar baixa neste pedido.';
      const code = message.split(':')[0] || 'SCAN_FAILED';
      const status = code === 'QR_NOT_ASSIGNED' || code === 'ORDER_CANCELLED' ? 409 : 400;
      return reply.status(status).send(
        formatError(code, message.replace(/^[^:]+:\s*/, ''), request.requestId)
      );
    }
  }

  async history(request: FastifyRequest, reply: FastifyReply) {
    const driverId = requireDriverContext(request, reply);
    if (!driverId) return;
    const query = request.query as { page?: string; limit?: string };
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { runs, total } = await deliveryRunService.listHistory(driverId, { page, limit });
    return reply.send(formatPaginated(runs, total, page, limit));
  }

  async listRegions(_request: FastifyRequest, reply: FastifyReply) {
    const regions = await deliveryRegionRepository.findAllActive();
    return reply.send(formatSuccess(regions));
  }
}

export const driverController = new DriverController();
