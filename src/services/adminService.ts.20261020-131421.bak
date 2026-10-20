import { env } from '../config/env.js';
import { isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { userRepository } from '../repositories/userRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { logsRepository } from '../repositories/logsRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';

export class AdminService {
  async getDashboard() {
    const [
      usersCount,
      productsResult,
      ordersResult,
      metrics,
      recentErrors,
      recentRequests,
      settings,
    ] = await Promise.all([
      userRepository.count(),
      productRepository.findAll({ limit: 100 }),
      orderRepository.findAll({ limit: 1000 }),
      logsRepository.getMetrics(),
      logsRepository.findLogs({ hasError: true, limit: 10 }),
      logsRepository.findLogs({ limit: 20 }),
      settingsRepository.getAll(),
    ]);

    const orders = ordersResult.orders;
    const ordersPending = orders.filter((o) => o.status === 'pending').length;
    const ordersPreparing = orders.filter((o) => o.status === 'preparing').length;
    const ordersDelivered = orders.filter((o) => o.status === 'delivered').length;
    const ordersCancelled = orders.filter((o) => o.status === 'cancelled').length;

    return {
      api_status: 'ONLINE',
      environment: env.NODE_ENV,
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      last_check: new Date().toISOString(),
      database: 'CONNECTED',
      supabase: isSupabaseConfigured() ? 'CONNECTED' : 'DISCONNECTED',
      counts: {
        users: usersCount,
        products: productsResult.total,
        orders: ordersResult.total,
        orders_pending: ordersPending,
        orders_preparing: ordersPreparing,
        orders_delivered: ordersDelivered,
        orders_cancelled: ordersCancelled,
      },
      metrics: {
        total_requests: metrics.totalRequests,
        total_errors: metrics.totalErrors,
        avg_duration_ms: metrics.avgDurationMs,
        status_2xx: metrics.status2xx,
        status_3xx: metrics.status3xx,
        status_4xx: metrics.status4xx,
        status_5xx: metrics.status5xx,
      },
      recent_errors: recentErrors.logs,
      recent_requests: recentRequests.logs,
      settings,
    };
  }
}

export const adminService = new AdminService();
