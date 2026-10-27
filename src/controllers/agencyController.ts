import { FastifyRequest, FastifyReply } from 'fastify';
import { agencyService } from '../services/agencyService.js';
import {
  agencyIdParamSchema,
  agencySlugParamSchema,
  listAgenciesQuerySchema,
  createAgencySchema,
  updateAgencySchema,
} from '../schemas/agency.schema.js';
import { formatSuccess, formatPaginated, formatError } from '../utils/response.js';

export class AgencyController {
  async listPublic(request: FastifyRequest, reply: FastifyReply) {
    const query = listAgenciesQuerySchema.parse(request.query);
    const { agencies, total } = await agencyService.listPublic({
      page: query.page,
      limit: query.limit,
      city: query.city,
      state: query.state,
    });
    return reply.send(formatPaginated(agencies, total, query.page, query.limit));
  }

  async getPublicById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = agencyIdParamSchema.parse(request.params);
    const agency = await agencyService.getPublicById(id);
    if (!agency) {
      return reply.status(404).send(
        formatError('AGENCY_NOT_FOUND', 'Agência não encontrada.', request.requestId)
      );
    }
    return reply.send(formatSuccess(agency));
  }

  async getPublicBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = agencySlugParamSchema.parse(request.params);
    const agency = await agencyService.getPublicBySlug(slug);
    if (!agency) {
      return reply.status(404).send(
        formatError('AGENCY_NOT_FOUND', 'Agência não encontrada.', request.requestId)
      );
    }
    return reply.send(formatSuccess(agency));
  }

  async listAdmin(request: FastifyRequest, reply: FastifyReply) {
    const query = listAgenciesQuerySchema.parse(request.query);
    const { agencies, total } = await agencyService.listAdmin({
      page: query.page,
      limit: query.limit,
      city: query.city,
      state: query.state,
      activeOnly: query.active_only ?? false,
    });
    return reply.send(formatPaginated(agencies, total, query.page, query.limit));
  }

  async getAdminById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = agencyIdParamSchema.parse(request.params);
    const agency = await agencyService.getById(id);
    if (!agency) {
      return reply.status(404).send(
        formatError('AGENCY_NOT_FOUND', 'Agência não encontrada.', request.requestId)
      );
    }
    return reply.send(formatSuccess(agency));
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createAgencySchema.parse(request.body);
    const agency = await agencyService.create(body);
    return reply.status(201).send(formatSuccess(agency));
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = agencyIdParamSchema.parse(request.params);
    const body = updateAgencySchema.parse(request.body);
    const agency = await agencyService.update(id, body);
    return reply.send(formatSuccess(agency));
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = agencyIdParamSchema.parse(request.params);
    await agencyService.delete(id);
    return reply.send(formatSuccess({ message: 'Agência excluída com sucesso.' }));
  }
}

export const agencyController = new AgencyController();
