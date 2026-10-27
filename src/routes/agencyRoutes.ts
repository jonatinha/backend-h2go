import { FastifyInstance } from 'fastify';
import { agencyController } from '../controllers/agencyController.js';

export async function agencyRoutes(fastify: FastifyInstance) {
  fastify.get('/agencies', agencyController.listPublic.bind(agencyController));
  fastify.get('/agencies/slug/:slug', agencyController.getPublicBySlug.bind(agencyController));
  fastify.get('/agencies/:id', agencyController.getPublicById.bind(agencyController));
}
