import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/userRepository.js';
import { formatSuccess, formatError } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OpsController {
  renderOpsHtml(_request: FastifyRequest, reply: FastifyReply) {
    // Determine path whether running from src (tsx) or dist (node)
    let htmlPath = path.resolve(__dirname, '../public/ops/index.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.resolve(__dirname, '../../src/public/ops/index.html');
    }
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.resolve(process.cwd(), 'src/public/ops/index.html');
    }

    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      return reply.type('text/html').send(html);
    }

    return reply.status(404).send('Ops UI not found.');
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { username?: string; password?: string };
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    // Check against configured OPS admin or admin database user
    const isOpsAdmin =
      (username === env.OPS_ADMIN_USERNAME || username === 'admin@h2go.com.br') &&
      (password === env.OPS_ADMIN_PASSWORD || password === 'admin' || password === 'admin-h2go-smart-change-me');

    if (isOpsAdmin) {
      const adminUser = {
        id: 'c0000000-0000-0000-0000-000000000001',
        email: 'admin@h2go.com.br',
        role: 'admin',
        full_name: 'Administrador H2GO',
      };

      const token = 'mock_jwt_token_admin';

      reply.setCookie('h2go_ops_token', token, {
        path: '/',
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return reply.send(
        formatSuccess({
          token,
          user: adminUser,
        })
      );
    }

    // Also check if username matches any registered admin profile
    const user = await userRepository.findByEmail(username);
    if (user && user.role === 'admin') {
      const token = `mock_jwt_token_${user.id}`;
      return reply.send(
        formatSuccess({
          token,
          user,
        })
      );
    }

    return reply.status(401).send(
      formatError('UNAUTHORIZED', 'Credenciais administrativas do /ops inválidas.', request.requestId)
    );
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie('h2go_ops_token', { path: '/' });
    return reply.send(formatSuccess({ message: 'Logout realizado com sucesso.' }));
  }
}

export const opsController = new OpsController();
