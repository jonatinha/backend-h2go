import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import path from 'path';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { requestLoggerHook } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { setupSwagger } from './plugins/swagger.js';

import { authRoutes } from './routes/authRoutes.js';
import { productRoutes } from './routes/productRoutes.js';
import { cartRoutes } from './routes/cartRoutes.js';
import { addressRoutes } from './routes/addressRoutes.js';
import { orderRoutes } from './routes/orderRoutes.js';
import { paymentRoutes } from './routes/paymentRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { opsRoutes } from './routes/opsRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { formatError } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Handled by our custom structured logger and /ops
    trustProxy: true,
  });

  // 1. Core Security Plugins
  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for swagger-ui & /ops dashboard SPA
  });

  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
  });

  await app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  // 2. Static Assets for /ops
  let staticRoot = path.resolve(__dirname, 'public');
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: '/ops/assets/',
  });

  // 3. Documentation (Swagger /docs)
  await setupSwagger(app);

  // 4. Global Middlewares & Hooks
  app.addHook('onRequest', requestIdMiddleware);
  app.addHook('onResponse', requestLoggerHook);

  // 5. Global Error Handling
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send(
      formatError('NOT_FOUND', `Rota [${request.method}] ${request.url} não encontrada.`, request.requestId)
    );
  });

  // 6. Routes Registration
  // Root / Health / Ops
  await app.register(healthRoutes);
  await app.register(opsRoutes);

  // API Version 1
  await app.register(
    async (apiV1) => {
      await apiV1.register(authRoutes);
      await apiV1.register(productRoutes);
      await apiV1.register(cartRoutes);
      await apiV1.register(addressRoutes);
      await apiV1.register(orderRoutes);
      await apiV1.register(paymentRoutes);
      await apiV1.register(adminRoutes);
    },
    { prefix: env.API_PREFIX }
  );

  return app;
}
