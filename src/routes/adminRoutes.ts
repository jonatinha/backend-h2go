import { FastifyInstance } from 'fastify';
import { adminController } from '../controllers/adminController.js';
import { receiptController } from '../controllers/receiptController.js';
import { printRequestController } from '../controllers/printRequestController.js';
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
  fastify.delete('/admin/users/:id', adminController.deleteUser.bind(adminController));
  fastify.get('/admin/users/:userId/addresses', adminController.listUserAddresses.bind(adminController));
  fastify.post('/admin/users/:userId/addresses', adminController.createUserAddress.bind(adminController));

  // Orders (Pedidos & Localização)
  fastify.get('/admin/orders', adminController.listOrders.bind(adminController));
  fastify.post('/admin/orders', adminController.createOrder.bind(adminController));
  fastify.post('/admin/orders/scan', adminController.scanOrder.bind(adminController));
  fastify.get('/admin/receipt-sessions/:sessionId', receiptController.getSessionStatus.bind(receiptController));
  fastify.get('/admin/receipts', receiptController.listAdmin.bind(receiptController));
  fastify.get('/admin/receipts/:id/print', receiptController.printAdmin.bind(receiptController));
  fastify.get('/admin/receipts/:id', receiptController.getAdmin.bind(receiptController));
  fastify.get('/admin/print-requests', printRequestController.listActive.bind(printRequestController));
  fastify.get('/admin/print-requests/archived', printRequestController.listArchived.bind(printRequestController));
  fastify.post('/admin/print-requests/register', printRequestController.register.bind(printRequestController));
  fastify.post('/admin/print-requests/mark-printed', printRequestController.markPrinted.bind(printRequestController));
  fastify.post('/admin/print-requests/delete', printRequestController.remove.bind(printRequestController));
  fastify.get('/admin/orders/:id', adminController.getOrderById.bind(adminController));
  fastify.patch('/admin/orders/:id/status', adminController.updateOrderStatus.bind(adminController));
  fastify.patch('/admin/orders/:id', adminController.updateOrder.bind(adminController));
  fastify.post('/admin/orders/:id/archive', adminController.archiveOrder.bind(adminController));
  fastify.post('/admin/orders/:id/unarchive', adminController.unarchiveOrder.bind(adminController));
  fastify.delete('/admin/orders/:id', adminController.deleteOrder.bind(adminController));

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

  fastify.get('/admin/stock', adminController.listStock.bind(adminController));
  fastify.post('/admin/stock/movements', adminController.createStockMovement.bind(adminController));

  // System, Logs & Health
  fastify.get('/admin/logs', adminController.listLogs.bind(adminController));
  fastify.get('/admin/system', adminController.getSystemSettings.bind(adminController));
  fastify.post('/admin/system', adminController.updateSystemSetting.bind(adminController));
  fastify.get('/admin/health', adminController.getHealth.bind(adminController));
}
