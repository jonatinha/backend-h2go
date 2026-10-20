import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { userRepository } from '../repositories/userRepository.js';
import { formatError } from '../utils/response.js';

async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string
): Promise<void> {
  const requestId = request.requestId || 'req_auth';

  if (process.env.NODE_ENV === 'test' && token.startsWith('mock_jwt_token_')) {
    const userId = token.slice('mock_jwt_token_'.length);
    if (!userId || userId.startsWith('refreshed_')) {
      reply.status(401).send(formatError('INVALID_TOKEN', 'Token de teste inválido.', requestId));
      return;
    }

    const profile = await userRepository.findById(userId);
    if (!profile) {
      reply.status(401).send(formatError('INVALID_TOKEN', 'Usuário de teste não encontrado.', requestId));
      return;
    }
    if (!profile.is_active) {
      reply.status(403).send(formatError('USER_INACTIVE', 'Esta conta está desativada.', requestId));
      return;
    }

    request.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
    };
    return;
  }

  if (!token || !isSupabaseConfigured()) {
    reply.status(401).send(
      formatError('UNAUTHORIZED', 'Token inválido ou autenticação indisponível.', requestId)
    );
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      reply.status(401).send(formatError('INVALID_TOKEN', 'Token inválido ou expirado.', requestId));
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      request.log.error({ err: profileError }, 'Falha ao consultar perfil autenticado');
      reply.status(503).send(
        formatError('PROFILE_LOOKUP_FAILED', 'Não foi possível verificar as permissões.', requestId)
      );
      return;
    }

    if (!profile) {
      reply.status(403).send(formatError('PROFILE_REQUIRED', 'Usuário sem perfil autorizado.', requestId));
      return;
    }
    if (!profile.is_active) {
      reply.status(403).send(formatError('USER_INACTIVE', 'Esta conta está desativada.', requestId));
      return;
    }

    request.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
    };
  } catch (err) {
    request.log.error({ err }, 'Erro ao validar token Supabase');
    reply.status(503).send(formatError('AUTH_ERROR', 'Falha ao validar autenticação.', requestId));
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send(
      formatError('UNAUTHORIZED', 'Autenticação necessária.', request.requestId || 'req_auth')
    );
  }

  return authenticateToken(request, reply, authHeader.slice(7).trim());
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const cookieToken = request.cookies?.h2go_ops_token;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : cookieToken;

  if (!token) {
    return reply.status(401).send(
      formatError('UNAUTHORIZED', 'Autenticação administrativa necessária.', request.requestId || 'req_admin')
    );
  }

  await authenticateToken(request, reply, token);
  if (reply.sent) return;

  if (!request.user || request.user.role !== 'admin') {
    return reply.status(403).send(
      formatError('FORBIDDEN', 'Apenas administradores podem acessar este recurso.', request.requestId || 'req_admin')
    );
  }
}
