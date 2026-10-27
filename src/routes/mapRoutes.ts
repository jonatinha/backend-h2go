import type { FastifyInstance } from 'fastify';
import { mapController } from '../controllers/mapController.js';

export async function mapRoutes(fastify: FastifyInstance) {
  fastify.get('/maps/status', mapController.status.bind(mapController));
  fastify.get('/maps/reverse-geocode', mapController.reverseGeocode.bind(mapController));
}
