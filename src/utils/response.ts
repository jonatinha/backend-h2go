import { ApiResponse, PaginatedResponse, ApiErrorResponse } from '../types/index.js';

export function formatSuccess<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function formatPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / (limit || 20)) || 1;
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export function formatError(
  code: string,
  message: string,
  requestId: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    requestId,
  };
}
