import { FastifyInstance } from 'fastify';
import { cartController } from '../controllers/cartController.js';
import { requireAuth } from '../middlewares/auth.js';

export async function cartRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/cart', cartController.getCart.bind(cartController));
  fastify.post('/cart/items', cartController.addItem.bind(cartController));
  fastify.patch('/cart/items/:itemId', cartController.updateItem.bind(cartController));
  fastify.delete('/cart/items/:itemId', cartController.removeItem.bind(cartController));
  fastify.delete('/cart', cartController.clearCart.bind(cartController));
  fastify.post('/cart/validate', cartController.validateCart.bind(cartController));
}
