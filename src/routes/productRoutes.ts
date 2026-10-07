import { FastifyInstance } from 'fastify';
import { productController } from '../controllers/productController.js';
import { requireAdmin } from '../middlewares/auth.js';

export async function productRoutes(fastify: FastifyInstance) {
  // Public product catalog
  fastify.get('/products', productController.list.bind(productController));
  fastify.get('/products/:id', productController.getById.bind(productController));
  fastify.get('/products/slug/:slug', productController.getBySlug.bind(productController));
  fastify.get('/categories', productController.listCategories.bind(productController));
  fastify.get('/categories/:id/products', productController.listCategoryProducts.bind(productController));

  // Admin product management
  fastify.post('/admin/products', { preHandler: [requireAdmin] }, productController.create.bind(productController));
  fastify.patch('/admin/products/:id', { preHandler: [requireAdmin] }, productController.update.bind(productController));
  fastify.delete('/admin/products/:id', { preHandler: [requireAdmin] }, productController.delete.bind(productController));
  fastify.patch('/admin/products/:id/status', { preHandler: [requireAdmin] }, productController.updateStatus.bind(productController));
  fastify.patch('/admin/products/:id/price', { preHandler: [requireAdmin] }, productController.updatePrice.bind(productController));
}
