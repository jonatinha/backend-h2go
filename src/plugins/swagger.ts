import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function setupSwagger(fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'H2GO SMART API',
        description:
          'API backend profissional para e-commerce de águas minerais e produtos relacionados, atendendo inicialmente a região de Ribeirão Branco - SP.',
        version: '1.0.0',
        contact: {
          name: 'Suporte H2GO Smart',
          email: 'contato@h2go.com.br',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Ambiente Local / Desenvolvimento',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Insira o token JWT do usuário ou de teste para autenticação.',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}
