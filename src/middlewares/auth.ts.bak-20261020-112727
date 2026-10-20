import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { userRepository } from '../repositories/userRepository.js';
import { formatError } from '../utils/response.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const requestId = request.requestId || 'req_auth';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send(
      formatError('UNAUTHORIZED', 'Autenticação necessária. Envie o token Bearer no header Authorization.', requestId)
    );
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Test / Mock Token handler (for testing & offline execution)
  if (token.startsWith('mock_jwt_token_')) {
    const userId = token.replace('mock_jwt_token_', '').replace('refreshed_', '');
    const user = await userRepository.findById(userId);
    if (user && user.is_active) {
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      };
      return;
    }
    // Default admin mock token
    if (token === 'mock_jwt_token_admin') {
      request.user = {
        id: 'c0000000-0000-0000-0000-000000000001',
        email: 'admin@h2go.com.br',
        role: 'admin',
        full_name: 'Administrador H2GO',
      };
      return;
    }
  }

  // Supabase Auth verification
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return reply.status(401).send(
          formatError('INVALID_TOKEN', 'Token de autenticação inválido ou expirado.', requestId)
        );
      }

      let profile = await userRepository.findById(data.user.id);
      if (!profile) {
        profile = await userRepository.createProfile({
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || null,
          phone: data.user.user_metadata?.phone || null,
          role: data.user.user_metadata?.role || 'customer',
          is_active: true,
        });
      }

      if (!profile.is_active) {
        return reply.status(403).send(
          formatError('USER_INACTIVE', 'Esta conta de usuário foi desativada.', requestId)
        );
      }

      request.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
      };
      return;
    } catch (err) {
      return reply.status(401).send(
        formatError('AUTH_ERROR', 'Falha ao validar autenticação.', requestId)
      );
    }
  }

  // If Supabase not configured and not a mock token
  return reply.status(401).send(
    formatError('UNAUTHORIZED', 'Token inválido ou serviço de autenticação indisponível.', requestId)
  );
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  // First ensure authenticated
  if (!request.user) {
    await requireAuth(request, reply);
    if (reply.sent) return;
  }

  const requestId = request.requestId || 'req_admin';

  if (!request.user || request.user.role !== 'admin') {
    return reply.status(403).send(
      formatError('FORBIDDEN', 'Acesso negado. Apenas administradores têm permissão para este recurso.', requestId)
    );
  }
}
