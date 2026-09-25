/**
 * @file api.ts
 * @description Common API contracts, normalized error representations, and request options.
 */

export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    dataSource: 'live' | 'mock' | 'cache';
  };
}

export interface ApiErrorPayload {
  message: string;
  statusCode: number;
  code?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.errors = payload.errors;
  }
}
