import { FastifyRequest, FastifyReply } from 'fastify';
import { generateRequestId } from '../utils/id.js';

export async function requestIdMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const reqId = (request.headers['x-request-id'] as string) || generateRequestId();
  request.requestId = reqId;
  request.startTime = Date.now();
  reply.header('X-Request-Id', reqId);
}
