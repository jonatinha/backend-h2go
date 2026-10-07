import { FastifyInstance } from 'fastify';
import { orderController } from '../controllers/orderController.js';
import { requireAuth } from '../middlewares/auth.js';

export async function orderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.post('/orders', orderController.create.bind(orderController));
  fastify.get('/orders', orderController.list.bind(orderController));
  fastify.get('/orders/:id', orderController.getById.bind(orderController));
  fastify.post('/orders/:id/cancel', orderController.cancel.bind(orderController));
}
