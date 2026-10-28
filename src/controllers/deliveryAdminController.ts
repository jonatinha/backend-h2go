import type { FastifyReply, FastifyRequest } from 'fastify';
import { formatError, formatPaginated, formatSuccess } from '../utils/response.js';
import {
  createDriverSchema,
  createRegionSchema,
  listDriversQuerySchema,
  resetDriverPasswordSchema,
  updateDriverSchema,
  updateRegionSchema,
} from '../schemas/delivery.schema.js';
import {
  deliveryDriverRepository,
  deliveryRegionRepository,
} from '../repositories/deliveryRepository.js';
import { deliveryDriverAdminService } from '../services/deliveryDriverAdminService.js';

export class DeliveryAdminController {
  async listDrivers(request: FastifyRequest, reply: FastifyReply) {
    const query = listDriversQuerySchema.parse(request.query);
    const { drivers, total } = await deliveryDriverRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      is_active: query.is_active === undefined ? undefined : query.is_active === 'true',
      region_id: query.region_id,
    });
    return reply.send(
      formatPaginated(drivers, total, query.page ?? 1, query.limit ?? 20)
    );
  }

  async getDriver(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const driver = await deliveryDriverAdminService.getDriverProfile(id);
    if (!driver) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Entregador não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess(driver));
  }

  async createDriver(request: FastifyRequest, reply: FastifyReply) {
    const body = createDriverSchema.parse(request.body);
    try {
      const driver = await deliveryDriverAdminService.createDriver(body);
      return reply.status(201).send(formatSuccess(driver));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao criar entregador.';
      return reply.status(400).send(formatError('CREATE_DRIVER_FAILED', message, request.requestId));
    }
  }

  async updateDriver(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = updateDriverSchema.parse(request.body);
    const updated = await deliveryDriverAdminService.updateDriver(id, body);
    if (!updated) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Entregador não encontrado.', request.requestId));
    }
    return reply.send(formatSuccess(updated));
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = resetDriverPasswordSchema.parse(request.body);
    const driver = await deliveryDriverRepository.findById(id);
    if (!driver) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Entregador não encontrado.', request.requestId));
    }
    await deliveryDriverAdminService.resetPassword(driver.profile_id, body.password);
    return reply.send(formatSuccess({ message: 'Senha redefinida.' }));
  }

  async listRegions(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { page?: string; limit?: string; search?: string };
    const { regions, total } = await deliveryRegionRepository.findAll({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 50,
      search: query.search,
    });
    return reply.send(formatPaginated(regions, total, Number(query.page) || 1, Number(query.limit) || 50));
  }

  async createRegion(request: FastifyRequest, reply: FastifyReply) {
    const body = createRegionSchema.parse(request.body);
    const region = await deliveryRegionRepository.create({
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      boundary_type: body.boundary_type,
      geometry: body.geometry ?? {},
      center_lat: body.center_lat ?? null,
      center_lng: body.center_lng ?? null,
      radius_km: body.radius_km ?? null,
      neighborhoods: body.neighborhoods ?? [],
      is_active: body.is_active ?? true,
    });
    return reply.status(201).send(formatSuccess(region));
  }

  async updateRegion(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = updateRegionSchema.parse(request.body);
    const updated = await deliveryRegionRepository.update(id, body);
    if (!updated) {
      return reply.status(404).send(formatError('NOT_FOUND', 'Região não encontrada.', request.requestId));
    }
    return reply.send(formatSuccess(updated));
  }

  async deleteRegion(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await deliveryRegionRepository.delete(id);
    return reply.send(formatSuccess({ message: 'Região removida.' }));
  }
}

export const deliveryAdminController = new DeliveryAdminController();
