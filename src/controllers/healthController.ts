import { FastifyRequest, FastifyReply } from 'fastify';
import { healthService } from '../services/healthService.js';

export class HealthController {
  getHealth(_request: FastifyRequest, reply: FastifyReply) {
    const health = healthService.getHealth();
    return reply.send(health);
  }

  getReady(_request: FastifyRequest, reply: FastifyReply) {
    const ready = healthService.getReady();
    return reply.send(ready);
  }
}

export const healthController = new HealthController();
