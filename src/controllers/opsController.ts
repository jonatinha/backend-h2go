import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { supabaseAnon, supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { formatSuccess, formatError } from '../utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OpsController {
  renderOpsHtml(_request: FastifyRequest, reply: FastifyReply) {
    let htmlPath = path.resolve(__dirname, '../public/ops/index.html');

    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.resolve(__dirname, '../../src/public/ops/index.html');
    }

    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.resolve(process.cwd(), 'src/public/ops/index.html');
    }

    if (fs.existsSync(htmlPath)) {
      return reply.type('text/html').send(fs.readFileSync(htmlPath, 'utf8'));
    }

    return reply.status(404).send('Ops UI not found.');
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { username?: string; password?: string } | undefined;
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return reply.status(400).send(
        formatError('VALIDATION_ERROR', 'Informe usuário e senha.', request.requestId)
      );
    }

    if (!isSupabaseConfigured()) {
      return reply.status(503).send(
        formatError(
          'AUTH_SERVICE_UNAVAILABLE',
          'Autenticação administrativa indisponível. Verifique a configuração do Supabase.',
          request.requestId
        )
      );
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: username,
      password,
    });

    if (error || !data.user || !data.session) {
      return reply.status(401).send(
        formatError('UNAUTHORIZED', 'Credenciais administrativas inválidas.', request.requestId)
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Ops profile lookup failed:', profileError.message);

      return reply.status(503).send(
        formatError('PROFILE_LOOKUP_FAILED', 'Não foi possível verificar o perfil administrativo.', request.requestId)
      );
    }

    if (!profile || profile.role !== 'admin' || profile.is_active !== true) {

      return reply.status(403).send(
        formatError('FORBIDDEN', 'Usuário sem permissão administrativa ativa.', request.requestId)
      );
    }

    const token = data.session.access_token;

    reply.setCookie('h2go_ops_token', token, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return reply.send(
      formatSuccess({
        user: {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          full_name: profile.full_name,
        },
      })
    );
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie('h2go_ops_token', { path: '/' });
    return reply.send(formatSuccess({ message: 'Logout realizado com sucesso.' }));
  }
}

export const opsController = new OpsController();
