import { FastifyInstance } from 'fastify';
import { paymentController } from '../controllers/paymentController.js';
import { requireAuth } from '../middlewares/auth.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post('/payments/create', { preHandler: [requireAuth] }, paymentController.create.bind(paymentController));
  fastify.get('/payments/:id', { preHandler: [requireAuth] }, paymentController.getById.bind(paymentController));
  fastify.post('/payments/webhook', paymentController.webhook.bind(paymentController));
}
