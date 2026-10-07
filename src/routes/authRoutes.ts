import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', authController.register.bind(authController));
  fastify.post('/auth/login', authController.login.bind(authController));
  fastify.post('/auth/logout', authController.logout.bind(authController));
  fastify.post('/auth/refresh', authController.refresh.bind(authController));
  fastify.post('/auth/forgot-password', authController.forgotPassword.bind(authController));
  fastify.get('/auth/me', { preHandler: [requireAuth] }, authController.getMe.bind(authController));
}
