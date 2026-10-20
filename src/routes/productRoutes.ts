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

  // Admin status and price routes (unique to productController)
  fastify.patch('/admin/products/:id/status', { preHandler: [requireAdmin] }, productController.updateStatus.bind(productController));
  fastify.patch('/admin/products/:id/price', { preHandler: [requireAdmin] }, productController.updatePrice.bind(productController));
}
