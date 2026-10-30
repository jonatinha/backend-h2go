import { FastifyInstance } from 'fastify';
import { adminController } from '../controllers/adminController.js';
import { agencyController } from '../controllers/agencyController.js';
import { deliveryAdminController } from '../controllers/deliveryAdminController.js';
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
  fastify.post('/admin/orders/scan', adminController.scanOrder.bind(adminController));
  fastify.get('/admin/orders/:id', adminController.getOrderById.bind(adminController));
  fastify.patch('/admin/orders/:id/status', adminController.updateOrderStatus.bind(adminController));
  fastify.patch('/admin/orders/:id', adminController.updateOrder.bind(adminController));

  // Agencies (Retirada na agência)
  fastify.get('/admin/agencies', agencyController.listAdmin.bind(agencyController));
  fastify.get('/admin/agencies/:id', agencyController.getAdminById.bind(agencyController));
  fastify.post('/admin/agencies', agencyController.create.bind(agencyController));
  fastify.patch('/admin/agencies/:id', agencyController.update.bind(agencyController));
  fastify.delete('/admin/agencies/:id', agencyController.delete.bind(agencyController));

  // Entregadores & regiões
  fastify.get('/admin/drivers', deliveryAdminController.listDrivers.bind(deliveryAdminController));
  fastify.get('/admin/drivers/:id', deliveryAdminController.getDriver.bind(deliveryAdminController));
  fastify.post('/admin/drivers', deliveryAdminController.createDriver.bind(deliveryAdminController));
  fastify.patch('/admin/drivers/:id', deliveryAdminController.updateDriver.bind(deliveryAdminController));
  fastify.post('/admin/drivers/:id/reset-password', deliveryAdminController.resetPassword.bind(deliveryAdminController));

  fastify.get('/admin/delivery-regions', deliveryAdminController.listRegions.bind(deliveryAdminController));
  fastify.post('/admin/delivery-regions', deliveryAdminController.createRegion.bind(deliveryAdminController));
  fastify.patch('/admin/delivery-regions/:id', deliveryAdminController.updateRegion.bind(deliveryAdminController));
  fastify.delete('/admin/delivery-regions/:id', deliveryAdminController.deleteRegion.bind(deliveryAdminController));

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
