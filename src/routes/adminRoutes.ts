import { FastifyInstance } from 'fastify';
import { adminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/auth.js';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAdmin);

  // Dashboard & Metrics
  fastify.get('/admin/dashboard', adminController.getDashboard.bind(adminController));

  // Users (Clientes & Admins)
  fastify.get('/admin/users', adminController.listUsers.bind(adminController));
  fastify.post('/admin/users', adminController.createUser.bind(adminController));
  fastify.patch('/admin/users/:id', adminController.updateUser.bind(adminController));

  // Orders (Pedidos & Localização)
  fastify.get('/admin/orders', adminController.listOrders.bind(adminController));
  fastify.get('/admin/orders/:id', adminController.getOrderById.bind(adminController));
  fastify.patch('/admin/orders/:id/status', adminController.updateOrderStatus.bind(adminController));
  fastify.patch('/admin/orders/:id', adminController.updateOrder.bind(adminController));

  // Products (Catálogo de Água)
  fastify.get('/admin/products', adminController.listProducts.bind(adminController));
  fastify.post('/admin/products', adminController.createProduct.bind(adminController));
  fastify.patch('/admin/products/:id', adminController.updateProduct.bind(adminController));
  fastify.delete('/admin/products/:id', adminController.deleteProduct.bind(adminController));

  // System, Logs & Health
  fastify.get('/admin/logs', adminController.listLogs.bind(adminController));
  fastify.get('/admin/system', adminController.getSystemSettings.bind(adminController));
  fastify.post('/admin/system', adminController.updateSystemSetting.bind(adminController));
  fastify.get('/admin/health', adminController.getHealth.bind(adminController));
}
