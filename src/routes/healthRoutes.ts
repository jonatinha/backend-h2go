import { FastifyInstance } from 'fastify';
import { healthController } from '../controllers/healthController.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', healthController.getHealth.bind(healthController));
  fastify.get('/ready', healthController.getReady.bind(healthController));
}
