import type { FastifyInstance } from 'fastify';
import { driverController } from '../controllers/driverController.js';
import { requireDriver } from '../middlewares/auth.js';

export async function driverRoutes(fastify: FastifyInstance) {
  fastify.post('/driver/auth/login', driverController.login.bind(driverController));

  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', requireDriver);

    protectedRoutes.get('/driver/me', driverController.me.bind(driverController));
    protectedRoutes.get('/driver/runs/available', driverController.listAvailable.bind(driverController));
    protectedRoutes.post('/driver/runs/:orderId/accept', driverController.accept.bind(driverController));
    protectedRoutes.get('/driver/runs/active', driverController.listActive.bind(driverController));
    protectedRoutes.patch('/driver/runs/:orderId/status', driverController.updateStatus.bind(driverController));
    protectedRoutes.post('/driver/orders/scan', driverController.scanOrder.bind(driverController));
    protectedRoutes.get('/driver/history', driverController.history.bind(driverController));
    protectedRoutes.get('/driver/regions', driverController.listRegions.bind(driverController));
  });
}
