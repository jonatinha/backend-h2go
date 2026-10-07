import { isSupabaseConfigured } from '../repositories/supabaseClient.js';

export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'h2go-api',
      version: '1.0.0',
      database: 'connected',
      supabase: isSupabaseConfigured() ? 'connected' : 'disconnected',
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  getReady() {
    return {
      ready: true,
      service: 'h2go-api',
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
