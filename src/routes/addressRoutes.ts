import { FastifyInstance } from 'fastify';
import { addressController } from '../controllers/addressController.js';
import { requireAuth } from '../middlewares/auth.js';

export async function addressRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/addresses', addressController.list.bind(addressController));
  fastify.post('/addresses', addressController.create.bind(addressController));
  fastify.get('/addresses/:id', addressController.getById.bind(addressController));
  fastify.patch('/addresses/:id', addressController.update.bind(addressController));
  fastify.delete('/addresses/:id', addressController.delete.bind(addressController));
}
