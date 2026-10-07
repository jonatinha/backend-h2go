import { ApiLog } from '../types/index.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

let memoryLogs: ApiLog[] = [];
const MAX_MEMORY_LOGS = 500;

export class LogsRepository {
  async createLog(log: Omit<ApiLog, 'id' | 'created_at'>): Promise<void> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const fullLog: ApiLog = {
      id,
      ...log,
      created_at: now,
    };

    if (isSupabaseConfigured()) {
      try {
        await supabaseAdmin.from('api_logs').insert({
          id: fullLog.id,
          request_id: fullLog.request_id,
          user_id: fullLog.user_id,
          method: fullLog.method,
          route: fullLog.route,
          status_code: fullLog.status_code,
          duration: fullLog.duration,
          ip: fullLog.ip,
          user_agent: fullLog.user_agent,
          error_code: fullLog.error_code,
          error_message: fullLog.error_message,
        });
      } catch (err) {
        // Silent catch for background logger
      }
    }

    memoryLogs.unshift(fullLog);
    if (memoryLogs.length > MAX_MEMORY_LOGS) {
      memoryLogs.pop();
    }
  }

  async findLogs(options?: {
    page?: number;
    limit?: number;
    method?: string;
    statusGroup?: '2xx' | '3xx' | '4xx' | '5xx';
    hasError?: boolean;
    search?: string;
  }): Promise<{ logs: ApiLog[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let filtered = [...memoryLogs];

    if (options?.method) {
      filtered = filtered.filter((l) => l.method.toUpperCase() === options.method!.toUpperCase());
    }

    if (options?.statusGroup) {
      const prefix = options.statusGroup.charAt(0);
      filtered = filtered.filter((l) => Math.floor(l.status_code / 100).toString() === prefix);
    }

    if (options?.hasError) {
      filtered = filtered.filter((l) => l.status_code >= 400 || l.error_code != null);
    }

    if (options?.search) {
      const s = options.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.route.toLowerCase().includes(s) ||
          l.request_id.toLowerCase().includes(s) ||
          (l.error_code && l.error_code.toLowerCase().includes(s)) ||
          (l.error_message && l.error_message.toLowerCase().includes(s))
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(from, to + 1);
    return { logs: paginated, total };
  }

  async getMetrics(): Promise<{
    totalRequests: number;
    totalErrors: number;
    avgDurationMs: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
  }> {
    const totalRequests = memoryLogs.length;
    let totalErrors = 0;
    let sumDuration = 0;
    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;

    for (const log of memoryLogs) {
      sumDuration += log.duration;
      const group = Math.floor(log.status_code / 100);
      if (group === 2) status2xx++;
      else if (group === 3) status3xx++;
      else if (group === 4) {
        status4xx++;
        totalErrors++;
      } else if (group === 5) {
        status5xx++;
        totalErrors++;
      }
    }

    const avgDurationMs = totalRequests > 0 ? Math.round((sumDuration / totalRequests) * 100) / 100 : 0;

    return {
      totalRequests,
      totalErrors,
      avgDurationMs,
      status2xx,
      status3xx,
      status4xx,
      status5xx,
    };
  }
}

export const logsRepository = new LogsRepository();
