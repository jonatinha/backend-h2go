import { FastifyInstance } from 'fastify';
import { opsController } from '../controllers/opsController.js';

export async function opsRoutes(fastify: FastifyInstance) {
  // SPA endpoints for /ops
  const opsViews = [
    '/ops',
    '/ops/dashboard',
    '/ops/requests',
    '/ops/errors',
    '/ops/database',
    '/ops/products',
    '/ops/orders',
    '/ops/users',
    '/ops/health',
    '/ops/settings',
  ];

  for (const view of opsViews) {
    fastify.get(view, opsController.renderOpsHtml.bind(opsController));
  }

  // Admin Ops Auth endpoints
  fastify.post('/ops/api/login', opsController.login.bind(opsController));
  fastify.post('/ops/api/logout', opsController.logout.bind(opsController));
}
