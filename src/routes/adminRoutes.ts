import { FastifyInstance } from 'fastify';
import { adminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/auth.js';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/dashboard', adminController.getDashboard.bind(adminController));
  fastify.get('/admin/users', adminController.listUsers.bind(adminController));
  fastify.get('/admin/orders', adminController.listOrders.bind(adminController));
  fastify.get('/admin/orders/:id', adminController.getOrderById.bind(adminController));
  fastify.patch('/admin/orders/:id/status', adminController.updateOrderStatus.bind(adminController));
  fastify.get('/admin/products', adminController.listProducts.bind(adminController));
  fastify.get('/admin/logs', adminController.listLogs.bind(adminController));
  fastify.get('/admin/system', adminController.getSystemSettings.bind(adminController));
  fastify.post('/admin/system', adminController.updateSystemSetting.bind(adminController));
  fastify.get('/admin/health', adminController.getHealth.bind(adminController));
}
