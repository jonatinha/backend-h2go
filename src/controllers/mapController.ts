import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { formatError, formatSuccess } from '../utils/response.js';
import { reverseGeocode, isMapboxServerConfigured } from '../services/mapboxService.js';
import { getMapboxUsageSnapshot } from '../services/mapboxUsageGuard.js';

const coordQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const mapController = {
  async status(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(
      formatSuccess({
        mapboxServer: isMapboxServerConfigured(),
        usage: getMapboxUsageSnapshot(),
      })
    );
  },

  async reverseGeocode(request: FastifyRequest, reply: FastifyReply) {
    const parsed = coordQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(formatError('INVALID_COORDS', 'Latitude e longitude inválidas.', request.requestId));
    }

    try {
      const ip = request.ip;
      const result = await reverseGeocode(parsed.data.lat, parsed.data.lng, ip);
      return reply.send(formatSuccess(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na geocodificação.';
      const status = message.includes('Cota') || message.includes('Muitas consultas') ? 429 : 502;
      return reply.status(status).send(formatError('MAPBOX_GEOCODE', message, request.requestId));
    }
  },
};
