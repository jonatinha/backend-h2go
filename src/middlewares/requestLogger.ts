import { FastifyRequest, FastifyReply } from 'fastify';
import { logsRepository } from '../repositories/logsRepository.js';

export async function requestLoggerHook(request: FastifyRequest, reply: FastifyReply) {
  // Ignore static assets & favicon from logging noise
  if (request.url.startsWith('/ops/assets') || request.url.includes('favicon')) {
    return;
  }

  const duration = Date.now() - (request.startTime || Date.now());
  const statusCode = reply.statusCode;

  const logEntry = {
    request_id: request.requestId || 'req_unknown',
    user_id: request.user?.id || null,
    method: request.method,
    route: request.routeOptions?.url || request.url,
    status_code: statusCode,
    duration,
    ip: request.ip,
    user_agent: (request.headers['user-agent'] as string) || null,
    error_code: null,
    error_message: null,
  };

  // Asynchronously write log to DB/memory without blocking response
  logsRepository.createLog(logEntry).catch(() => {});
}
