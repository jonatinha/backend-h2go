import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/authService.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
} from '../schemas/auth.schema.js';
import { formatSuccess, formatError } from '../utils/response.js';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(
      body.email,
      body.password,
      body.full_name,
      body.phone
    );
    return reply.status(201).send(formatSuccess(result));
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    return reply.send(formatSuccess(result));
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      await authService.logout(authHeader.replace('Bearer ', ''));
    }
    return reply.send(formatSuccess({ message: 'Sessão encerrada com sucesso.' }));
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const body = refreshSchema.parse(request.body);
    const result = await authService.refresh(body.refreshToken);
    return reply.send(formatSuccess(result));
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = forgotPasswordSchema.parse(request.body);
    await authService.forgotPassword(body.email);
    return reply.send(
      formatSuccess({
        message: 'Se o e-mail estiver cadastrado, as instruções de recuperação serão enviadas.',
      })
    );
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Não autenticado', request.requestId)
      );
    }
    const profile = await authService.getMe(request.user.id);
    return reply.send(formatSuccess(profile));
  }
}

export const authController = new AuthController();
