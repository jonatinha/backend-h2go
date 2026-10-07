import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { formatError } from '../utils/response.js';
import { logsRepository } from '../repositories/logsRepository.js';
import { env } from '../config/env.js';

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.requestId || 'req_unknown';

  // 1. Zod validation errors
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return reply.status(400).send(
      formatError('VALIDATION_ERROR', 'Dados de requisição inválidos.', requestId, details)
    );
  }

  // 2. Custom application errors with code: message format
  const message = error.message || 'Erro interno do servidor';
  if (message.includes(':')) {
    const [code, ...msgParts] = message.split(':');
    const cleanMsg = msgParts.join(':').trim();

    let statusCode = 400;
    if (code.includes('NOT_FOUND')) statusCode = 404;
    if (code.includes('UNAUTHORIZED') || code.includes('INVALID_CREDENTIALS')) statusCode = 401;
    if (code.includes('FORBIDDEN')) statusCode = 403;
    if (code.includes('OUT_OF_COVERAGE') || code.includes('CANNOT_CANCEL')) statusCode = 422;

    return reply.status(statusCode).send(
      formatError(code.trim(), cleanMsg, requestId)
    );
  }

  // 3. Fastify specific errors (e.g. 404, bad JSON payload)
  if ('statusCode' in error && error.statusCode) {
    return reply.status(error.statusCode).send(
      formatError(error.code || 'HTTP_ERROR', error.message, requestId)
    );
  }

  // 4. Log unexpected server errors
  logsRepository.createLog({
    request_id: requestId,
    user_id: request.user?.id || null,
    method: request.method,
    route: request.routeOptions?.url || request.url,
    status_code: 500,
    duration: Date.now() - (request.startTime || Date.now()),
    ip: request.ip,
    user_agent: (request.headers['user-agent'] as string) || null,
    error_code: 'INTERNAL_SERVER_ERROR',
    error_message: error.message,
  }).catch(() => {});

  const clientMsg = env.NODE_ENV === 'production'
    ? 'Ocorreu um erro interno. Por favor, tente novamente mais tarde.'
    : error.message;

  return reply.status(500).send(
    formatError('INTERNAL_SERVER_ERROR', clientMsg, requestId)
  );
}
